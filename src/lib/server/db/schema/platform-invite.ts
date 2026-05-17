import { sqliteTable, text, index, unique } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';
import { timestamp, uuid } from './columns';
import { user } from './auth';
import { band } from './band';

export const platformInvite = sqliteTable(
	'platform_invite',
	{
		id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		email: text('email').notNull(),
		token: text('token').notNull().unique().$defaultFn(() => crypto.randomUUID()),
		bandId: text('band_id')
			.notNull()
			.references(() => band.id, { onDelete: 'cascade' }),
		role: text('role').notNull(),
		position: text('position'),
		invitedById: text('invited_by_id')
			.notNull()
			.references(() => user.id, { onDelete: 'set null' }),
		status: text('status').notNull().default('pending'),
		expiresAt: timestamp('expires_at').notNull(),
		createdAt: timestamp('created_at').notNull().default(sql`(current_timestamp)`),
		acceptedAt: timestamp('accepted_at')
	},
	(t) => [
		index('idx_platform_invite_email').on(t.email),
		index('idx_platform_invite_band').on(t.bandId)
	]
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const platformInviteRelations = relations(platformInvite, ({ one }) => ({
	band: one(band, { fields: [platformInvite.bandId], references: [band.id] }),
	invitedBy: one(user, { fields: [platformInvite.invitedById], references: [user.id] }),
}));
