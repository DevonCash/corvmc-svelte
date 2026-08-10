import { sqliteTable, text, integer, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { user } from './authentication';
import {
	volunteerHourStatuses,
	VOLUNTEER_DESCRIPTION_MAX,
	VOLUNTEER_MAX_MINUTES_PER_LOG,
	VOLUNTEER_REVIEW_NOTES_MAX,
	VOLUNTEER_ROLE_DESCRIPTION_MAX,
	VOLUNTEER_ROLE_NAME_MAX
} from '../../../config';

// ---------------------------------------------------------------------------
// Volunteering domain types
// ---------------------------------------------------------------------------

export type VolunteerHourStatus = (typeof volunteerHourStatuses)[number];

export function isVolunteerHourStatus(value: string): value is VolunteerHourStatus {
	return volunteerHourStatuses.includes(value as VolunteerHourStatus);
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const createVolunteerRoleSchema = z.object({
	name: z.string().trim().min(1).max(VOLUNTEER_ROLE_NAME_MAX),
	description: z.string().trim().max(VOLUNTEER_ROLE_DESCRIPTION_MAX).optional(),
	displayOrder: z.coerce.number().int().min(0).default(0),
	isActive: z.coerce.boolean().default(true)
});

export const updateVolunteerRoleSchema = createVolunteerRoleSchema.partial();

export const submitHoursSchema = z.object({
	volunteerRoleId: z.uuid(),
	// YYYY-MM-DD in club time; the service anchors it at noon.
	workedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	minutes: z.coerce.number().int().min(1).max(VOLUNTEER_MAX_MINUTES_PER_LOG),
	description: z.string().trim().min(1).max(VOLUNTEER_DESCRIPTION_MAX)
});

export const reviewHoursSchema = z.object({
	id: z.uuid(),
	notes: z.string().trim().max(VOLUNTEER_REVIEW_NOTES_MAX).optional()
});

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/**
 * A volunteer role is a *job description*, not a permission. The auth roles
 * (`role` in ./authorization) are a different thing entirely — a row here grants
 * nothing. Staff-managed so the taxonomy can change without a migration, and a
 * table rather than a config list so each role can carry the markdown job
 * description the member-facing page is built around.
 */
export const volunteerRole = sqliteTable('volunteer_role', {
	id: text()
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull().unique(),
	description: text('description'),
	displayOrder: integer('display_order').notNull().default(0),

	// Retirement is an archive, not a delete: hour logs reference the role and
	// reports must keep resolving it. Archived roles disappear from the member
	// submit form and nowhere else.
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),

	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export const volunteerHourLog = sqliteTable(
	'volunteer_hour_log',
	{
		id: text()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),

		// The member is the subject of the row, so a hard account purge takes it —
		// same call as equipmentLoan.userId.
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),

		// Restrict, because every report groups by this. Staff archive a role they
		// no longer use; deleting one with history would silently rewrite the past.
		volunteerRoleId: text('volunteer_role_id')
			.notNull()
			.references(() => volunteerRole.id, { onDelete: 'restrict' }),

		// Phase 2 hook: the shift this log was filed against. A bare text column
		// rather than a references() — the target table doesn't exist yet, and
		// Phase 1 must not create an empty one just to satisfy a constraint.
		shiftId: text('shift_id'),

		// A calendar date, but this schema has no text-date columns, so it's a
		// timestamp anchored at NOON club time.
		//
		// The report buckets months with strftime('%Y-%m', ..., 'unixepoch'),
		// which reads the instant in UTC. Noon local lands mid-day in UTC for any
		// offset from -11 to +11, so the UTC month always matches the local date.
		// Midnight local happens to work for the Americas (00:00 PT = 07:00 UTC,
		// same day) but breaks for UTC-ahead zones, where it is the previous UTC
		// day — every 1st-of-the-month log would bucket into the prior month.
		// Noon costs nothing and removes the class of bug entirely.
		workedOn: integer('worked_on', { mode: 'timestamp' }).notNull(),

		// Integer minutes, never floats. The UI takes quarter-hours and renders
		// via formatVolunteerHours().
		minutes: integer('minutes').notNull(),
		description: text('description').notNull(),

		status: text('status', { enum: volunteerHourStatuses }).notNull().default('pending'),

		// set-null keeps the review through staff account deletion, matching
		// contentFlag.resolvedByUserId.
		reviewedByUserId: text('reviewed_by_user_id').references(() => user.id, {
			onDelete: 'set null'
		}),
		reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
		reviewNotes: text('review_notes'),

		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(t) => [
		index('volunteer_hour_log_user_idx').on(t.userId),
		// The pending queue, which is the page staff live on.
		index('volunteer_hour_log_status_idx').on(t.status, t.workedOn),
		index('volunteer_hour_log_worked_on_idx').on(t.workedOn),
		// The by-role rollup and the delete guard.
		index('volunteer_hour_log_role_idx').on(t.volunteerRoleId),
		// Backstop only — the service enforces the tighter VOLUNTEER_MAX_MINUTES_PER_LOG.
		check('volunteer_minutes_positive', sql`minutes > 0 AND minutes <= 1440`)
	]
);

export type VolunteerRole = typeof volunteerRole.$inferSelect;
export type VolunteerHourLog = typeof volunteerHourLog.$inferSelect;
