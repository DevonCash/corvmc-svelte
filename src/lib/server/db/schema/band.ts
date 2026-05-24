import { sqliteTable, text, integer, index, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { timestamp, uuid, zodJson, type Serialized } from './columns';
import { user, directoryContactSchema, profileLinksSchema } from './auth';

// ---------------------------------------------------------------------------
// Band domain types
// ---------------------------------------------------------------------------

export const bandRoles = ['owner', 'admin', 'member'] as const;
export type BandRole = (typeof bandRoles)[number];

export const bandMemberStatuses = ['pending', 'active'] as const;
export type BandMemberStatus = (typeof bandMemberStatuses)[number];

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const band = sqliteTable(
	'band',
	{
		id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		name: text('name').notNull().unique(),
		slug: text('slug').notNull().unique(),
		bio: text('bio'),
		ownerId: text('owner_id')
			.notNull()
			.references(() => user.id, { onDelete: 'set null' }),
		avatarKey: text('avatar_key'),
		createdAt: timestamp('created_at').notNull().default(sql`(current_timestamp)`),
		updatedAt: timestamp('updated_at').notNull().default(sql`(current_timestamp)`),
		deletedAt: timestamp('deleted_at'),

		// directory profile
		tagline: text('tagline'),
		lookingForMembers: integer('looking_for_members', { mode: 'boolean' }).notNull().default(false),
		directoryVisibility: text('directory_visibility').notNull().default('public'),
		directoryContact: zodJson(directoryContactSchema)('directory_contact'),
		links: zodJson(profileLinksSchema)('links')
	},
	(t) => [
		index('idx_band_slug').on(t.slug)
	]
);

export const bandGenre = sqliteTable(
	'band_genre',
	{
		bandId: text('band_id')
			.notNull()
			.references(() => band.id, { onDelete: 'cascade' }),
		genre: text('genre').notNull()
	},
	(t) => [
		index('idx_band_genre_band').on(t.bandId)
	]
);

export const bandMember = sqliteTable(
	'band_member',
	{
		id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		bandId: text('band_id')
			.notNull()
			.references(() => band.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		role: text('role', { enum: bandRoles }).notNull(),
		position: text('position'),
		status: text('status', { enum: bandMemberStatuses }).notNull(),
		invitedById: text('invited_by_id').references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at').notNull().default(sql`(current_timestamp)`)
	},
	(t) => [
		unique('band_member_band_user_unique').on(t.bandId, t.userId),
		index('idx_band_member_user').on(t.userId),
		index('idx_band_member_status').on(t.status)
	]
);

// ---------------------------------------------------------------------------
// Client-safe serialized types
// ---------------------------------------------------------------------------

export type Band = Serialized<typeof band.$inferSelect>;
export type BandMember = Serialized<typeof bandMember.$inferSelect>;