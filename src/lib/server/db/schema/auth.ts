import { pgTable, text, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// better-auth core tables
// ---------------------------------------------------------------------------
// These match better-auth's expected schema (snake_case, text PKs).
// The `user` table is extended with corvmc-specific fields below the
// standard better-auth columns.
// ---------------------------------------------------------------------------

export const user = pgTable('user', {
	// better-auth standard fields
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').notNull().default(false),
	image: text('image'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),

	// corvmc extensions
	pronouns: text('pronouns'),
	phone: text('phone'),
	settings: jsonb('settings'),
	stripeId: text('stripe_id'),
	pmType: text('pm_type'),
	pmLastFour: text('pm_last_four'),
	credits: jsonb('credits').notNull().default({}),
	trialEndsAt: timestamp('trial_ends_at'),
	deletedAt: timestamp('deleted_at'),

	// directory profile
	bio: text('bio'),
	tagline: text('tagline'),
	instruments: text('instruments').array(),
	genres: text('genres').array(),
	lookingForBand: boolean('looking_for_band').notNull().default(false),
	directoryOptOut: boolean('directory_opt_out').notNull().default(false),
	publicListing: boolean('public_listing').notNull().default(false),
	directoryContact: jsonb('directory_contact'),
	links: jsonb('links')
},
(t) => [
	index('idx_user_instruments').using('gin', t.instruments),
	index('idx_user_genres').using('gin', t.genres)
]);

export const session = pgTable('session', {
	id: text('id').primaryKey(),
	expiresAt: timestamp('expires_at').notNull(),
	token: text('token').notNull().unique(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' })
});

export const account = pgTable('account', {
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
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const verification = pgTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at').defaultNow()
});
