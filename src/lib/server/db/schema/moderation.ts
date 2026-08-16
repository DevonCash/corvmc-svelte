import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { user } from './authentication';
import { contentFlag } from './flag';

// ---------------------------------------------------------------------------
// Moderation domain types
// ---------------------------------------------------------------------------

/** Why a block exists. Shown to staff for context; never to the blocked person. */
export const userBlockSources = ['manual', 'declined_request', 'reported'] as const;
export type UserBlockSource = (typeof userBlockSources)[number];

/**
 * `restricted` — may reply to conversations they are already in, may not start
 * new ones. What an upheld report costs you.
 * `disabled`   — no messaging at all, in either direction.
 * `none`       — a restriction that was lifted. Kept rather than deleted so the
 *                history stays readable.
 */
export const messagingStatuses = ['none', 'restricted', 'disabled'] as const;
export type MessagingStatus = (typeof messagingStatuses)[number];

/** Who imposed a standing. Decides who is allowed to lift it. */
export const messagingStandingSources = ['staff', 'report', 'member'] as const;
export type MessagingStandingSource = (typeof messagingStandingSources)[number];

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/**
 * "I don't want to hear from this person."
 *
 * Rows point one way, but every check looks both ways — so one row is enough,
 * and two (both parties blocking) change nothing. Unblocking deletes the row:
 * unlike `messaging_standing` this is a live preference rather than a staff
 * decision, so there is no history worth preserving.
 *
 * Blocking is enforced on send, reply and accept. It is deliberately NOT
 * enforced on reads — the person who blocked still needs the conversation in
 * order to report it.
 */
export const userBlock = sqliteTable(
	'user_block',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		blockerUserId: text('blocker_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		blockedUserId: text('blocked_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		source: text('source', { enum: userBlockSources }).notNull().default('manual'),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(t) => [
		uniqueIndex('uq_user_block_pair').on(t.blockerUserId, t.blockedUserId),
		index('idx_user_block_blocked').on(t.blockedUserId)
	]
);

export type UserBlock = typeof userBlock.$inferSelect;

/**
 * One messaging switch per member, covering all three ways it gets thrown:
 * restricted after staff uphold a report, switched off by staff (how we handle
 * the occasional under-18 member — the site has no age of its own), and
 * switched off by the member themselves.
 *
 * Works the same way as `communityEventStanding`: no row means no restriction,
 * and lifting one sets `status: 'none'` instead of deleting the row, so "we
 * looked at this and cleared it" still reads differently from "this never came
 * up".
 *
 * `source` is only consulted when deciding who may change it — a member may
 * lift their own, never one staff or a report put there.
 */
export const messagingStanding = sqliteTable('messaging_standing', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	status: text('status', { enum: messagingStatuses }).notNull(),
	source: text('source', { enum: messagingStandingSources }).notNull(),
	/** The staff note, shown to the member so they know why. */
	reason: text('reason'),
	/** The report that cost them standing. Null when staff or the member set it. */
	triggeringFlagId: text('triggering_flag_id').references(() => contentFlag.id, {
		onDelete: 'set null'
	}),
	updatedByUserId: text('updated_by_user_id').references(() => user.id, {
		onDelete: 'set null'
	}),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export type MessagingStanding = typeof messagingStanding.$inferSelect;
