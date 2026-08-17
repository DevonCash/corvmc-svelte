import { db } from '$lib/server/db';
import {
	userBlock,
	messagingStanding,
	type UserBlockSource,
	type MessagingStatus,
	type MessagingStandingSource
} from '$lib/server/db/schema/moderation';
import { user } from '$lib/server/db/schema/authentication';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

/**
 * A SQL fragment: "these two have a block between them, either way round."
 *
 * Exported as a fragment rather than a boolean helper so it can go straight
 * into a WHERE clause. A caller that fetches a row and then checks a boolean
 * has a race and a second code path; a caller whose query simply cannot return
 * the row has neither.
 */
export function blockExistsBetween(aUserId: string, bUserId: string): SQL {
	return sql`EXISTS (SELECT 1 FROM user_block ub
	                   WHERE (ub.blocker_user_id = ${aUserId} AND ub.blocked_user_id = ${bUserId})
	                      OR (ub.blocker_user_id = ${bUserId} AND ub.blocked_user_id = ${aUserId}))`;
}

/** The same question as an await, for the paths that are deciding whether to create something. */
export async function isBlockedEitherWay(aUserId: string, bUserId: string): Promise<boolean> {
	const [row] = await db
		.select({ id: userBlock.id })
		.from(userBlock)
		.where(
			or(
				and(eq(userBlock.blockerUserId, aUserId), eq(userBlock.blockedUserId, bUserId)),
				and(eq(userBlock.blockerUserId, bUserId), eq(userBlock.blockedUserId, aUserId))
			)
		)
		.limit(1);
	return Boolean(row);
}

export interface BlockUserParams {
	blockerUserId: string;
	blockedUserId: string;
	source?: UserBlockSource;
}

/**
 * Idempotent: blocking someone twice, or both people blocking each other, is
 * fine. Every check reads in both directions, so a second row changes nothing.
 */
export async function blockUser(params: BlockUserParams): Promise<void> {
	if (params.blockerUserId === params.blockedUserId) return;
	await db
		.insert(userBlock)
		.values({
			blockerUserId: params.blockerUserId,
			blockedUserId: params.blockedUserId,
			source: params.source ?? 'manual'
		})
		.onConflictDoNothing();
}

/**
 * Removes only this person's block. If the other party blocked too, their row
 * stands and the two still cannot reach each other — which is correct, and the
 * thing to remember before "simplifying" this to delete both directions.
 */
export async function unblockUser(blockerUserId: string, blockedUserId: string): Promise<void> {
	await db
		.delete(userBlock)
		.where(
			and(eq(userBlock.blockerUserId, blockerUserId), eq(userBlock.blockedUserId, blockedUserId))
		);
}

export interface BlockedMember {
	userId: string;
	name: string;
	source: UserBlockSource;
	createdAt: Date;
}

/** Who this member has blocked, for their own account page. */
export async function listBlockedBy(blockerUserId: string): Promise<BlockedMember[]> {
	const rows = await db
		.select({
			userId: userBlock.blockedUserId,
			name: user.name,
			source: userBlock.source,
			createdAt: userBlock.createdAt
		})
		.from(userBlock)
		.innerJoin(user, eq(user.id, userBlock.blockedUserId))
		.where(eq(userBlock.blockerUserId, blockerUserId))
		.orderBy(desc(userBlock.createdAt));

	return rows.map((r) => ({
		userId: r.userId,
		name: r.name,
		source: r.source,
		createdAt: r.createdAt
	}));
}

// ---------------------------------------------------------------------------
// Messaging standing
// ---------------------------------------------------------------------------

export interface MessagingStandingState {
	status: MessagingStatus;
	source: MessagingStandingSource | null;
	reason: string | null;
	updatedAt: Date | null;
}

const UNRESTRICTED: MessagingStandingState = {
	status: 'none',
	source: null,
	reason: null,
	updatedAt: null
};

/**
 * No row means no restriction — the overwhelmingly common case, and the default
 * the whole feature is built around. Same contract as `getCommunityStanding`.
 */
export async function getMessagingStanding(userId: string): Promise<MessagingStandingState> {
	const [row] = await db
		.select({
			status: messagingStanding.status,
			source: messagingStanding.source,
			reason: messagingStanding.reason,
			updatedAt: messagingStanding.updatedAt
		})
		.from(messagingStanding)
		.where(eq(messagingStanding.userId, userId))
		.limit(1);

	if (!row) return UNRESTRICTED;
	return row;
}

/** May this member start new conversations? */
export async function canInitiateMessages(userId: string): Promise<boolean> {
	const { status } = await getMessagingStanding(userId);
	return status === 'none';
}

/** May anyone message this member at all, in either direction? */
export async function messagingIsDisabled(userId: string): Promise<boolean> {
	const { status } = await getMessagingStanding(userId);
	return status === 'disabled';
}

export interface SetMessagingStandingParams {
	userId: string;
	status: MessagingStatus;
	source: MessagingStandingSource;
	reason?: string | null;
	/** Who made the change. Null when the member changed their own. */
	actorUserId?: string | null;
	/** The upheld report, when a report is what caused this. */
	flagId?: string | null;
}

export class MessagingStandingNotYoursError extends Error {
	constructor() {
		super('This restriction was applied by staff and cannot be changed here.');
		this.name = 'MessagingStandingNotYoursError';
	}
}

/**
 * Write a member's messaging standing.
 *
 * A member switching their own messaging off — and back on — goes through here
 * with `source: 'member'`, and may only ever write over an absent row or one
 * they set themselves. Without that check, "turn my messages back on" would
 * also clear a restriction staff imposed, which is the entire point of having
 * imposed it.
 *
 * Lifting sets `status: 'none'` rather than deleting the row, so a member who
 * was restricted and later cleared still reads differently from one who never
 * was.
 */
export async function setMessagingStanding(params: SetMessagingStandingParams): Promise<void> {
	if (params.source === 'member') {
		const existing = await getMessagingStanding(params.userId);
		const theirOwn = existing.status === 'none' || existing.source === 'member';
		if (!theirOwn) throw new MessagingStandingNotYoursError();
	}

	const values = {
		userId: params.userId,
		status: params.status,
		source: params.source,
		reason: params.reason ?? null,
		triggeringFlagId: params.flagId ?? null,
		updatedByUserId: params.actorUserId ?? null,
		updatedAt: new Date()
	};

	await db
		.insert(messagingStanding)
		.values(values)
		.onConflictDoUpdate({
			target: messagingStanding.userId,
			set: {
				status: values.status,
				source: values.source,
				reason: values.reason,
				triggeringFlagId: values.triggeringFlagId,
				updatedByUserId: values.updatedByUserId,
				updatedAt: values.updatedAt
			}
		});
}

/** Called from flag-service when staff uphold a report about a conversation. */
export async function restrictMessaging(params: {
	userId: string;
	flagId: string;
	staffId: string;
	reason?: string | null;
}): Promise<void> {
	await setMessagingStanding({
		userId: params.userId,
		status: 'restricted',
		source: 'report',
		reason: params.reason ?? null,
		actorUserId: params.staffId,
		flagId: params.flagId
	});
}
