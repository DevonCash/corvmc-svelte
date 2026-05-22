import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { timestamp, zodJson, type Serialized } from './columns';
import { z } from 'zod';
// ---------------------------------------------------------------------------
// Profile types (shared with band.ts)
// ---------------------------------------------------------------------------

export type DirectoryVisibility = 'hidden' | 'members' | 'public';

export const subscriptionSchema = z.object({
	startedAt: z.string(),
	stripeSubscriptionId: z.string(),
	hoursPerReset: z.number(),
	creditsResetAt: z.string(),
}).nullable().default(null);

export type Subscription = z.infer<typeof subscriptionSchema>;

export const directoryContactSchema = z.object({
	email: z.string().optional(),
	phone: z.string().optional(),
	social: z.string().optional(),
	address: z.string().optional(),
	visibility: z.string().optional(),
}).nullable().default(null);

export type DirectoryContact = z.infer<typeof directoryContactSchema>;

export const profileLinkSchema = z.object({
	label: z.string(),
	url: z.string()
});

export const profileLinksSchema = z.array(profileLinkSchema).nullable().default(null);

export type ProfileLink = z.infer<typeof profileLinkSchema>;

// ---------------------------------------------------------------------------
// better-auth core tables
// ---------------------------------------------------------------------------

export const user = sqliteTable('user', {
	// better-auth standard fields
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
	image: text('image'),
	createdAt: timestamp('created_at').notNull().default(sql`(current_timestamp)`),
	updatedAt: timestamp('updated_at').notNull().default(sql`(current_timestamp)`),

	// corvmc extensions
	pronouns: text('pronouns'),
	phone: text('phone'),
	settings: zodJson(z.record(z.string(), z.unknown()).nullable().default(null))('settings'),
	stripeId: text('stripe_id'),
	pmType: text('pm_type'),
	pmLastFour: text('pm_last_four'),
	creditFreeHours: integer('credit_free_hours').notNull().default(0),
	creditEquipment: integer('credit_equipment').notNull().default(0),
	subscription: zodJson(subscriptionSchema)('subscription'),
	trialEndsAt: timestamp('trial_ends_at'),
	deletedAt: timestamp('deleted_at'),

	// directory profile
	bio: text('bio'),
	tagline: text('tagline'),
	lookingForBand: integer('looking_for_band', { mode: 'boolean' }).notNull().default(false),
	directoryVisibility: text('directory_visibility').notNull().default('members'),
	directoryContact: zodJson(directoryContactSchema)('directory_contact'),
	links: zodJson(profileLinksSchema)('links')
});

export const userInstrument = sqliteTable(
	'user_instrument',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		instrument: text('instrument').notNull()
	},
	(t) => [
		index('idx_user_instrument_user').on(t.userId)
	]
);

export const userGenre = sqliteTable(
	'user_genre',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		genre: text('genre').notNull()
	},
	(t) => [
		index('idx_user_genre_user').on(t.userId)
	]
);

export const session = sqliteTable('session', {
	id: text('id').primaryKey(),
	expiresAt: timestamp('expires_at').notNull(),
	token: text('token').notNull().unique(),
	createdAt: timestamp('created_at').notNull().default(sql`(current_timestamp)`),
	updatedAt: timestamp('updated_at').notNull().default(sql`(current_timestamp)`),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' })
});

export const account = sqliteTable('account', {
	id: text('id').primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at'),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
	scope: text('scope'),
	password: text('password'),
	createdAt: timestamp('created_at').notNull().default(sql`(current_timestamp)`),
	updatedAt: timestamp('updated_at').notNull().default(sql`(current_timestamp)`)
});

export const verification = sqliteTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at').default(sql`(current_timestamp)`),
	updatedAt: timestamp('updated_at').default(sql`(current_timestamp)`)
});

// ---------------------------------------------------------------------------
// Client-safe serialized types
// ---------------------------------------------------------------------------

export type User = Serialized<typeof user.$inferSelect>;