import { pgTable, text, timestamp, uuid, index, unique } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const band = pgTable(
	'band',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		name: text('name').notNull().unique(),
		slug: text('slug').notNull().unique(),
		bio: text('bio'),
		ownerId: text('owner_id')
			.notNull()
			.references(() => user.id, { onDelete: 'set null' }),
		avatarKey: text('avatar_key'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
		deletedAt: timestamp('deleted_at', { withTimezone: true })
	},
	(t) => [index('idx_band_slug').on(t.slug)]
);

export const bandMember = pgTable(
	'band_member',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		bandId: uuid('band_id')
			.notNull()
			.references(() => band.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		role: text('role').notNull(), // 'owner' | 'admin' | 'member'
		position: text('position'),
		status: text('status').notNull(), // 'pending' | 'active'
		invitedById: text('invited_by_id').references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		unique('band_member_band_user_unique').on(t.bandId, t.userId),
		index('idx_band_member_user').on(t.userId),
		index('idx_band_member_status').on(t.status)
	]
);
