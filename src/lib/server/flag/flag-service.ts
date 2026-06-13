import { db } from '$lib/server/db';
import { contentFlag } from '$lib/server/db/schema/flag';
import type { FlagEntityType, FlagStatus } from '$lib/server/db/schema/flag';
import { user } from '$lib/server/db/schema/authentication';
import { band } from '$lib/server/db/schema/band';
import { eq, and, desc, count, like, inArray, getTableColumns } from 'drizzle-orm';
import { paginate, type PaginationInput } from '$lib/server/db/paginate';
import { domainEvents } from '$lib/server/events/event-bus';
import { captureException } from '$lib/server/sentry';

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export const FLAG_REASON_MAX = 100;
export const FLAG_DESCRIPTION_MAX = 1000;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class FlagNotFoundError extends Error {
	constructor() {
		super('Flag not found');
		this.name = 'FlagNotFoundError';
	}
}

export class FlagTargetNotFoundError extends Error {
	constructor() {
		super('The content being reported could not be found');
		this.name = 'FlagTargetNotFoundError';
	}
}

export class FlagAlreadyResolvedError extends Error {
	constructor() {
		super('This flag has already been resolved');
		this.name = 'FlagAlreadyResolvedError';
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function entityHref(entityType: FlagEntityType, entityId: string): string {
	return entityType === 'band_profile' ? `/staff/bands/${entityId}` : `/staff/users/${entityId}`;
}

/** Resolve a display name for a flagged entity, or null if it no longer exists. */
async function resolveEntityLabel(
	entityType: FlagEntityType,
	entityId: string
): Promise<string | null> {
	if (entityType === 'band_profile') {
		const [row] = await db
			.select({ name: band.name })
			.from(band)
			.where(eq(band.id, entityId))
			.limit(1);
		return row?.name ?? null;
	}
	const [row] = await db
		.select({ name: user.name })
		.from(user)
		.where(eq(user.id, entityId))
		.limit(1);
	return row?.name ?? null;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export interface CreateFlagParams {
	entityType: FlagEntityType;
	entityId: string;
	reportedByUserId: string;
	reportedByName: string;
	reason: string;
	description?: string;
}

export async function createFlag(params: CreateFlagParams) {
	const entityLabel = await resolveEntityLabel(params.entityType, params.entityId);
	if (entityLabel === null) throw new FlagTargetNotFoundError();

	const [flag] = await db
		.insert(contentFlag)
		.values({
			entityType: params.entityType,
			entityId: params.entityId,
			reportedByUserId: params.reportedByUserId,
			reason: params.reason.slice(0, FLAG_REASON_MAX),
			description: params.description?.slice(0, FLAG_DESCRIPTION_MAX) || null
		})
		.returning();

	// Fire-and-forget: notify staff without blocking the reporter's request.
	Promise.resolve().then(async () => {
		try {
			await domainEvents.emit('content.flagged', {
				flagId: flag.id,
				entityType: flag.entityType,
				entityId: flag.entityId,
				entityLabel,
				reason: flag.reason,
				reportedByUserId: params.reportedByUserId,
				reportedByName: params.reportedByName
			});
		} catch (err) {
			captureException(err, { event: 'content.flagged', flagId: flag.id });
		}
	});

	return flag;
}

export interface ResolveFlagParams {
	resolution: Extract<FlagStatus, 'resolved' | 'dismissed'>;
	notes?: string;
	staffId: string;
}

export async function resolveFlag(flagId: string, params: ResolveFlagParams) {
	const [existing] = await db
		.select({ status: contentFlag.status })
		.from(contentFlag)
		.where(eq(contentFlag.id, flagId))
		.limit(1);

	if (!existing) throw new FlagNotFoundError();
	if (existing.status !== 'pending') throw new FlagAlreadyResolvedError();

	const [row] = await db
		.update(contentFlag)
		.set({
			status: params.resolution,
			resolutionNotes: params.notes?.slice(0, FLAG_DESCRIPTION_MAX) || null,
			resolvedByUserId: params.staffId,
			resolvedAt: new Date(),
			updatedAt: new Date()
		})
		.where(eq(contentFlag.id, flagId))
		.returning();

	return row;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export interface FlagFilters {
	status?: FlagStatus;
	search?: string;
}

export async function listFlags(filters: FlagFilters, pagination: PaginationInput) {
	const conditions = [];
	if (filters.status) conditions.push(eq(contentFlag.status, filters.status));
	if (filters.search?.trim()) {
		conditions.push(like(contentFlag.reason, `%${filters.search.trim()}%`));
	}
	const where = conditions.length ? and(...conditions) : undefined;

	const dataQ = db
		.select({
			id: contentFlag.id,
			entityType: contentFlag.entityType,
			entityId: contentFlag.entityId,
			reason: contentFlag.reason,
			status: contentFlag.status,
			createdAt: contentFlag.createdAt,
			reportedByName: user.name
		})
		.from(contentFlag)
		.innerJoin(user, eq(user.id, contentFlag.reportedByUserId))
		.where(where)
		.orderBy(desc(contentFlag.createdAt))
		.$dynamic();

	const countQ = db.select({ count: count() }).from(contentFlag).where(where);

	const { rows, pagination: pageInfo } = await paginate(dataQ, countQ, pagination);

	// Resolve entity labels in two batched lookups (no N+1).
	const memberIds = rows.filter((r) => r.entityType === 'member_profile').map((r) => r.entityId);
	const bandIds = rows.filter((r) => r.entityType === 'band_profile').map((r) => r.entityId);

	const memberNames = memberIds.length
		? await db
				.select({ id: user.id, name: user.name })
				.from(user)
				.where(inArray(user.id, memberIds))
		: [];
	const bandNames = bandIds.length
		? await db.select({ id: band.id, name: band.name }).from(band).where(inArray(band.id, bandIds))
		: [];

	const labelMap = new Map<string, string>();
	for (const m of memberNames) labelMap.set(`member_profile:${m.id}`, m.name);
	for (const b of bandNames) labelMap.set(`band_profile:${b.id}`, b.name);

	return {
		rows: rows.map((r) => ({
			...r,
			entityLabel: labelMap.get(`${r.entityType}:${r.entityId}`) ?? '(deleted)',
			entityHref: entityHref(r.entityType, r.entityId)
		})),
		pagination: pageInfo
	};
}

export async function getFlag(flagId: string) {
	const [row] = await db
		.select({
			flag: getTableColumns(contentFlag),
			reportedByName: user.name,
			reportedByEmail: user.email
		})
		.from(contentFlag)
		.innerJoin(user, eq(user.id, contentFlag.reportedByUserId))
		.where(eq(contentFlag.id, flagId))
		.limit(1);

	if (!row) throw new FlagNotFoundError();

	const entityLabel = await resolveEntityLabel(row.flag.entityType, row.flag.entityId);

	return {
		...row.flag,
		reportedByName: row.reportedByName,
		reportedByEmail: row.reportedByEmail,
		entityLabel: entityLabel ?? '(deleted)',
		entityHref: entityHref(row.flag.entityType, row.flag.entityId)
	};
}
