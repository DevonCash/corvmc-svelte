import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, form } from '$app/server';
import { requireStaff } from '$lib/server/authorization';
import { requireFeature } from '$lib/server/feature-flags';
import { handleContactForm } from '$lib/server/inbox/inbound-handlers';
import {
	listThreads,
	getThread,
	assignThread as assignThreadSvc,
	updateStatus,
	getUnresolvedCount
} from '$lib/server/inbox/thread-service';
import {
	getAllChannelConfigs,
	getEnabledChannels,
	updateChannelConfig as updateChannelConfigSvc
} from '$lib/server/inbox/channel-config-service';
import { addOutboundMessage, addNote } from '$lib/server/inbox/message-service';
import { submitContactFormSchema } from '$lib/server/db/schema/inbox';
import { inboxChannels, inboxThreadStatuses } from '$lib/config';

// ---------------------------------------------------------------------------
// Public forms
// ---------------------------------------------------------------------------

export const submitContactForm = form(submitContactFormSchema, async (data) => {
	await handleContactForm(data);
	return { success: true };
});

// ---------------------------------------------------------------------------
// Staff queries
// ---------------------------------------------------------------------------

const threadFiltersSchema = z.object({
	status: z.enum(inboxThreadStatuses).optional(),
	channel: z.enum(inboxChannels).optional(),
	assignedToUserId: z.string().optional(),
	search: z.string().optional(),
	page: z.coerce.number().int().min(1).optional()
});

export const getInboxThreads = query(threadFiltersSchema, async (filters) => {
	await requireFeature('staffInbox');
	await requireStaff();
	return listThreads(
		{
			status: filters.status,
			channel: filters.channel,
			assignedToUserId: filters.assignedToUserId,
			search: filters.search
		},
		{ page: filters.page ?? 1, pageSize: 25 }
	);
});

export const getInboxThread = query(z.string(), async (id) => {
	await requireFeature('staffInbox');
	await requireStaff();
	const thread = await getThread(id);
	if (!thread) throw error(404, 'Thread not found');
	return thread;
});

export const getInboxUnreadCount = query(z.void(), async () => {
	await requireFeature('staffInbox');
	await requireStaff();
	return getUnresolvedCount();
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
	userId: z.string().optional().transform((v) => v || null)
});

export const assignThread = form(assignSchema, async (data) => {
	await requireStaff();
	await assignThreadSvc(data.threadId, data.userId);
	return { success: true };
});

const statusSchema = z.object({
	threadId: z.string().min(1),
	status: z.enum(inboxThreadStatuses)
});

export const updateThreadStatus = form(statusSchema, async (data) => {
	await requireStaff();
	await updateStatus(data.threadId, data.status);
	void getInboxThread(data.threadId).refresh();
	return { success: true };
});

// ---------------------------------------------------------------------------
// Channel configuration
// ---------------------------------------------------------------------------

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
