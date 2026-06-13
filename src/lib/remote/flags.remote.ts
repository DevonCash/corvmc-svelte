import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, form } from '$app/server';
import { requireStaff, requireUser } from '$lib/server/authorization';
import { requireFeature } from '$lib/server/feature-flags';
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
	notes: z.string().max(FLAG_DESCRIPTION_MAX).optional()
});

export const resolveFlag = form(resolveSchema, async (data) => {
	await requireFeature('contentFlags');
	const staff = await requireStaff();
	try {
		await resolveFlagSvc(data.flagId, {
			resolution: data.resolution,
			notes: data.notes,
			staffId: staff.id
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
