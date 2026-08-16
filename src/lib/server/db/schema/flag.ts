import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { user } from './authentication';

// ---------------------------------------------------------------------------
// Content flag domain types
// ---------------------------------------------------------------------------

export const flagEntityTypes = ['member_profile', 'band_profile', 'event', 'inbox_thread'] as const;
export type FlagEntityType = (typeof flagEntityTypes)[number];

/**
 * What the shared member report form is allowed to target.
 *
 * `inbox_thread` is deliberately absent. `submitFlag` takes its entity type and
 * id straight from the browser with no ownership check, which is fine for
 * profiles and public listings but would let any member push a stranger's
 * private conversation into the staff queue — and being in the queue is what
 * makes a conversation readable. Reporting a DM goes through
 * `reportDirectThread` instead, which checks the reporter is in it.
 */
export const memberReportableEntityTypes = ['member_profile', 'band_profile', 'event'] as const;
export type MemberReportableEntityType = (typeof memberReportableEntityTypes)[number];

export const flagStatuses = ['pending', 'resolved', 'dismissed'] as const;
export type FlagStatus = (typeof flagStatuses)[number];

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const contentFlag = sqliteTable(
	'content_flag',
	{
		id: text()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),

		// Polymorphic target (member profile, band profile, or event). Drizzle v1
		// lacks polymorphic relations, so we store a type discriminator + entity
		// id, matching the reservation.bookerType / bookerId pattern.
		entityType: text('entity_type', { enum: flagEntityTypes }).notNull(),
		entityId: text('entity_id').notNull(),

		// Null for anonymous public reports (event listings are reportable by
		// anyone, Turnstile-gated). set-null keeps reports through account deletion.
		reportedByUserId: text('reported_by_user_id').references(() => user.id, {
			onDelete: 'set null'
		}),
		reason: text('reason').notNull(),
		description: text('description'),

		status: text('status', { enum: flagStatuses }).notNull().default('pending'),
		resolvedByUserId: text('resolved_by_user_id').references(() => user.id, {
			onDelete: 'set null'
		}),
		resolutionNotes: text('resolution_notes'),

		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		resolvedAt: integer('resolved_at', { mode: 'timestamp' })
	},
	(t) => [
		index('content_flag_status_idx').on(t.status),
		index('content_flag_entity_idx').on(t.entityType, t.entityId)
	]
);

export type ContentFlag = typeof contentFlag.$inferSelect;
