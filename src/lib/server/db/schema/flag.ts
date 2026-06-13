import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { user } from './authentication';

// ---------------------------------------------------------------------------
// Content flag domain types
// ---------------------------------------------------------------------------

export const flagEntityTypes = ['member_profile', 'band_profile'] as const;
export type FlagEntityType = (typeof flagEntityTypes)[number];

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

		// Polymorphic target (member profile or band profile). Drizzle v1 lacks
		// polymorphic relations, so we store a type discriminator + entity id,
		// matching the reservation.bookerType / bookerId pattern.
		entityType: text('entity_type', { enum: flagEntityTypes }).notNull(),
		entityId: text('entity_id').notNull(),

		reportedByUserId: text('reported_by_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
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
