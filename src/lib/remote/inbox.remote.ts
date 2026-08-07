import { z } from 'zod';
import { error, invalid } from '@sveltejs/kit';
import { query, form, getRequestEvent } from '$app/server';
import { verifyTurnstile } from '$lib/server/turnstile';
import { requireStaff, listStaffUsers } from '$lib/server/authorization';
import { dispatch } from '$lib/server/notification/dispatcher';
import { handleContactForm } from '$lib/server/inbox/inbound-handlers';
import { getStaffLayout } from '$lib/remote/layout.remote';
import {
	listThreads,
	getThread,
	assignThread as assignThreadSvc,
	updateStatus,
	getUnresolvedCount,
	countThreadsByStatus
} from '$lib/server/inbox/thread-service';
import {
	getAllChannelConfigs,
	getEnabledChannels,
	updateChannelConfig as updateChannelConfigSvc
} from '$lib/server/inbox/channel-config-service';
import { addOutboundMessage, addNote } from '$lib/server/inbox/message-service';
import { submitContactFormSchema } from '$lib/server/db/schema/inbox';
import { buildDateInTz } from '$lib/server/reservation/timezone';
import { DEFAULT_TIMEZONE, inboxChannels, inboxThreadStatuses } from '$lib/config';

// ---------------------------------------------------------------------------
// Public forms
// ---------------------------------------------------------------------------

export const submitContactForm = form(submitContactFormSchema, async (data, issue) => {
	const ip = getRequestEvent().request.headers.get('CF-Connecting-IP');
	if (!(await verifyTurnstile(data.turnstileToken, ip))) {
		invalid(issue.turnstileToken('Verification failed. Please try again.'));
	}
	await handleContactForm(data);
	return { success: true };
});

// ---------------------------------------------------------------------------
// Staff queries
// ---------------------------------------------------------------------------

const threadFiltersSchema = z.object({
	status: z.enum(inboxThreadStatuses).optional(),
	channel: z.enum(inboxChannels).optional(),
	/** A staff user id, or the sentinels `mine` / `unassigned`. */
	assigned: z.string().optional(),
	search: z.string().optional(),
	page: z.coerce.number().int().min(1).optional()
});

export const getInboxThreads = query(threadFiltersSchema, async (filters) => {
	const staff = await requireStaff();

	// `undefined` leaves the filter off entirely; `null` is the IS NULL branch in
	// listThreads, so the two cannot be collapsed.
	const assignedToUserId =
		filters.assigned === undefined
			? undefined
			: filters.assigned === 'unassigned'
				? null
				: filters.assigned === 'mine'
					? staff.id
					: filters.assigned;

	return listThreads(
		{
			status: filters.status,
			channel: filters.channel,
			assignedToUserId,
			search: filters.search
		},
		{ page: filters.page ?? 1, pageSize: 25 }
	);
});

export const getInboxThreadCounts = query(z.void(), async () => {
	await requireStaff();
	return countThreadsByStatus();
});

export const getInboxThread = query(z.string(), async (id) => {
	await requireStaff();
	const thread = await getThread(id);
	if (!thread) throw error(404, 'Thread not found');
	return thread;
});

export const getInboxUnreadCount = query(z.void(), async () => {
	await requireStaff();
	return getUnresolvedCount();
});

export const getAssignableStaff = query(z.void(), async () => {
	await requireStaff();
	return listStaffUsers();
});

// ---------------------------------------------------------------------------
// Staff forms
// ---------------------------------------------------------------------------

const replySchema = z.object({
	threadId: z.string().min(1),
	body: z.string().trim().min(1).max(10000)
});

export const replyToThread = form(replySchema, async (data) => {
	const staff = await requireStaff();
	const thread = await getThread(data.threadId);
	if (!thread) throw error(404, 'Thread not found');

	await addOutboundMessage({
		threadId: data.threadId,
		body: data.body,
		authorUserId: staff.id,
		authorName: staff.name
	});

	void getInboxThread(data.threadId).refresh();
	return { success: true };
});

const noteSchema = z.object({
	threadId: z.string().min(1),
	body: z.string().trim().min(1).max(5000)
});

export const addThreadNote = form(noteSchema, async (data) => {
	const staff = await requireStaff();
	const thread = await getThread(data.threadId);
	if (!thread) throw error(404, 'Thread not found');

	await addNote({
		threadId: data.threadId,
		authorUserId: staff.id,
		body: data.body
	});

	void getInboxThread(data.threadId).refresh();
	return { success: true };
});

const assignSchema = z.object({
	threadId: z.string().min(1),
	userId: z
		.string()
		.optional()
		.transform((v) => v || null)
});

export const assignThread = form(assignSchema, async (data) => {
	const staff = await requireStaff();
	await assignThreadSvc(data.threadId, data.userId);

	// Notify the assignee, unless they assigned the thread to themselves.
	if (data.userId && data.userId !== staff.id) {
		const assignee = (await listStaffUsers()).find((u) => u.id === data.userId);
		const thread = await getThread(data.threadId);
		if (assignee && thread) {
			await dispatch({
				type: 'inbox_assigned',
				userId: assignee.id,
				userEmail: assignee.email,
				title: 'A conversation was assigned to you',
				body: thread.subject ?? thread.contactName ?? undefined,
				href: `/staff/inbox/${data.threadId}`
			});
		}
	}

	void getInboxThread(data.threadId).refresh();
	return { success: true };
});

const statusSchema = z.object({
	threadId: z.string().min(1),
	status: z.enum(inboxThreadStatuses),
	/** `YYYY-MM-DD` from the snooze calendar; only meaningful when snoozing. */
	snoozedUntil: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.optional()
});

export const updateThreadStatus = form(statusSchema, async (data) => {
	await requireStaff();

	// A calendar date means "put this back in the queue that morning", so it
	// resolves against club time rather than UTC midnight — otherwise snoozing
	// until tomorrow wakes the thread at 5pm today.
	const snoozedUntil = data.snoozedUntil
		? buildDateInTz(data.snoozedUntil, '08:00', DEFAULT_TIMEZONE)
		: undefined;

	await updateStatus(data.threadId, data.status, snoozedUntil);
	void getInboxThread(data.threadId).refresh();
	void getInboxThreadCounts().refresh();
	void getInboxUnreadCount().refresh();
	// The staff nav badge counts open threads, so resolving from the detail page
	// has to refresh the layout too or the sidebar keeps the old number.
	void getStaffLayout().refresh();
	return { success: true };
});

// ---------------------------------------------------------------------------
// Channel configuration
// ---------------------------------------------------------------------------

// Channel configuration is staff-only but deliberately *not* feature-gated: it
// lives on the settings page next to the staffInbox flag itself, so requiring
// the flag to read it would make the inbox impossible to configure before
// turning it on.
export const getInboxChannelConfigs = query(z.void(), async () => {
	await requireStaff();
	return getAllChannelConfigs();
});

export const getInboxEnabledChannels = query(z.void(), async () => {
	await requireStaff();
	return getEnabledChannels();
});

const channelConfigSchema = z.object({
	channel: z.enum(inboxChannels),
	enabled: z.enum(['true', 'false']).transform((v) => v === 'true')
});

export const updateInboxChannelConfig = form(channelConfigSchema, async (data) => {
	await requireStaff();
	await updateChannelConfigSvc(data.channel, data.enabled);
	void getInboxChannelConfigs().refresh();
	void getInboxEnabledChannels().refresh();
	return { success: true };
});
