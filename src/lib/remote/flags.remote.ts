import { z } from 'zod';
import { error, invalid } from '@sveltejs/kit';
import { query, form, getRequestEvent } from '$app/server';
import { requireStaff, requireUser } from '$lib/server/authorization';
import { requireFeature, isFeatureEnabled } from '$lib/server/feature-flags';
import { verifyTurnstile } from '$lib/server/turnstile';
import { getById as getEventById } from '$lib/server/event/event-service';
import { flagEntityTypes, flagStatuses } from '$lib/server/db/schema/flag';
import {
	listFlags,
	getFlag,
	createFlag,
	resolveFlag as resolveFlagSvc,
	FLAG_REASON_MAX,
	FLAG_DESCRIPTION_MAX,
	FlagNotFoundError,
	FlagTargetNotFoundError,
	FlagAlreadyResolvedError
} from '$lib/server/flag/flag-service';

// ---------------------------------------------------------------------------
// Queries (staff)
// ---------------------------------------------------------------------------

const flagFiltersSchema = z.object({
	status: z.enum(flagStatuses).optional(),
	search: z.string().optional(),
	page: z.number().optional()
});

export const getFlagsQueue = query(flagFiltersSchema, async (filters) => {
	await requireFeature('contentFlags');
	await requireStaff();
	return listFlags(
		{ status: filters.status, search: filters.search },
		{ page: filters.page ?? 1, pageSize: 25 }
	);
});

export const getFlagDetail = query(z.string(), async (flagId) => {
	await requireFeature('contentFlags');
	await requireStaff();
	try {
		return await getFlag(flagId);
	} catch (err) {
		if (err instanceof FlagNotFoundError) error(404, err.message);
		throw err;
	}
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const resolveSchema = z.object({
	flagId: z.string().min(1),
	resolution: z.enum(['resolved', 'dismissed']),
	notes: z.string().max(FLAG_DESCRIPTION_MAX).optional(),
	unpublishEvent: z.boolean().default(false)
});

export const resolveFlag = form(resolveSchema, async (data) => {
	await requireFeature('contentFlags');
	const staff = await requireStaff();
	try {
		await resolveFlagSvc(data.flagId, {
			resolution: data.resolution,
			notes: data.notes,
			staffId: staff.id,
			unpublishEvent: data.unpublishEvent
		});
	} catch (err) {
		if (err instanceof FlagNotFoundError) error(404, err.message);
		if (err instanceof FlagAlreadyResolvedError) error(409, err.message);
		throw err;
	}
	void getFlagDetail(data.flagId).refresh();
	void getFlagsQueue({}).refresh();
	return { success: true };
});

const submitSchema = z.object({
	entityType: z.enum(flagEntityTypes),
	entityId: z.string().min(1),
	reason: z.string().trim().min(1).max(FLAG_REASON_MAX),
	description: z.string().trim().max(FLAG_DESCRIPTION_MAX).optional()
});

export const submitFlag = form(submitSchema, async (data) => {
	await requireFeature('contentFlags');
	const reporter = requireUser();
	try {
		await createFlag({
			entityType: data.entityType,
			entityId: data.entityId,
			reportedByUserId: reporter.id,
			reportedByName: reporter.name,
			reason: data.reason,
			description: data.description
		});
	} catch (err) {
		if (err instanceof FlagTargetNotFoundError) error(404, err.message);
		throw err;
	}
	return { success: true };
});

// ---------------------------------------------------------------------------
// Public event reporting
// ---------------------------------------------------------------------------

// The gig guide is public, so event reports accept anonymous visitors —
// Turnstile-gated like the other public forms. Signed-in users get their
// identity attached automatically.
const submitEventReportSchema = z.object({
	eventId: z.string().min(1),
	reason: z.string().trim().min(1).max(FLAG_REASON_MAX),
	description: z.string().trim().max(FLAG_DESCRIPTION_MAX).optional(),
	turnstileToken: z.string().min(1)
});

export const submitEventReport = form(submitEventReportSchema, async (data, issue) => {
	await requireFeature('contentFlags');

	const { request, locals } = getRequestEvent();
	const ip = request.headers.get('CF-Connecting-IP');
	if (!(await verifyTurnstile(data.turnstileToken, ip))) {
		invalid(issue.turnstileToken('Verification failed. Please try again.'));
	}

	// Only publicly visible events are reportable — mirrors getPublicEventDetail
	// so draft/cancelled events (and band events while the flag is off) can't be
	// probed by id.
	const evt = await getEventById(data.eventId);
	if (!evt || evt.status !== 'published') error(404, 'Event not found');
	if (evt.source === 'band' && !(await isFeatureEnabled('bandEvents'))) {
		error(404, 'Event not found');
	}

	try {
		await createFlag({
			entityType: 'event',
			entityId: data.eventId,
			reportedByUserId: locals.user?.id,
			reportedByName: locals.user?.name,
			reason: data.reason,
			description: data.description
		});
	} catch (err) {
		if (err instanceof FlagTargetNotFoundError) error(404, err.message);
		throw err;
	}
	return { success: true };
});
