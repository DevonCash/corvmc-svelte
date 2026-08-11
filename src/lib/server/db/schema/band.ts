import { sqliteTable, text, integer, index, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { user } from './authentication';

// ---------------------------------------------------------------------------
// Band domain types
// ---------------------------------------------------------------------------

export const bandRoles = ['owner', 'admin', 'member'] as const;
export type BandRole = (typeof bandRoles)[number];

export const bandMemberStatuses = ['pending', 'active'] as const;
export type BandMemberStatus = (typeof bandMemberStatuses)[number];

export const bandTiers = ['free', 'premium'] as const;
export type BandTier = (typeof bandTiers)[number];

export const bandSubscriptionSchema = z
	.object({
		startedAt: z.string(),
		stripeSubscriptionId: z.string(),
		billingInterval: z.enum(['monthly', 'yearly']),
		currentPeriodEnd: z.string(),
		cancelAtPeriodEnd: z.boolean().optional()
	})
	.nullable()
	.default(null);

export type BandSubscription = z.infer<typeof bandSubscriptionSchema>;

export const customDomainStatuses = ['pending', 'active', 'failed'] as const;
export type CustomDomainStatus = (typeof customDomainStatuses)[number];

/**
 * The DNS records a band must add at their registrar, straight from
 * Cloudflare's custom-hostname response. `ownership` proves they control the
 * domain; `ssl` lets Cloudflare issue the certificate. Both are TXT records, so
 * the band can verify before pointing the domain at us — no window where their
 * live site is broken.
 */
export const customDomainVerificationSchema = z
	.object({
		ownership: z.object({ name: z.string(), value: z.string() }).nullable(),
		ssl: z.object({ name: z.string(), value: z.string() }).nullable(),
		/** Where the band points the domain itself, once verified. */
		cnameTarget: z.string()
	})
	.nullable()
	.default(null);

export type CustomDomainVerification = z.infer<typeof customDomainVerificationSchema>;

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const band = sqliteTable(
	'band',
	{
		id: text()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		// Deliberately NOT unique. Two bands may share a name — only the slug has
		// to be distinct, and `ensureUniqueSlug` guarantees that by suffixing.
		// The old UNIQUE here made `create()` throw a raw D1 constraint error
		// (surfaced as a 500) on any duplicate name, including one still held by a
		// soft-deleted band, since `deactivate()` only sets `deletedAt`.
		name: text('name').notNull(),
		slug: text('slug').notNull().unique(),
		bio: text('bio'),
		ownerId: text('owner_id')
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		avatarKey: text('avatar_key'),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		deletedAt: integer('deleted_at', { mode: 'timestamp' }),

		// subscription & tier
		tier: text('tier', { enum: bandTiers }).notNull().default('free'),
		subscription: text('subscription', { mode: 'json' }).$type<BandSubscription>(),

		// custom domain (premium only — every band gets {slug}.corvmc.org for free).
		// Backed by a Cloudflare for SaaS custom hostname; `customDomainHostnameId`
		// is that hostname's id, needed to poll status and to delete it.
		customDomain: text('custom_domain').unique(),
		customDomainStatus: text('custom_domain_status', { enum: customDomainStatuses }),
		customDomainHostnameId: text('custom_domain_hostname_id'),
		customDomainVerification: text('custom_domain_verification', {
			mode: 'json'
		}).$type<CustomDomainVerification>(),
		customDomainAddedAt: integer('custom_domain_added_at', { mode: 'timestamp' }),

		// directory profile
		tagline: text('tagline'),
		hometown: text('hometown'),
		foundedYear: text('founded_year'),
		lookingForMembers: integer('looking_for_members', { mode: 'boolean' }).notNull().default(false),
		directoryVisibility: text('directory_visibility').notNull().default('public'),
		directoryContact: text('directory_contact', { mode: 'json' }),
		links: text('links', { mode: 'json' })
	},
	(t) => [index('idx_band_slug').on(t.slug)]
);

export const bandGenre = sqliteTable(
	'band_genre',
	{
		bandId: text('band_id')
			.notNull()
			.references(() => band.id, { onDelete: 'cascade' }),
		genre: text('genre').notNull()
	},
	(t) => [index('idx_band_genre_band').on(t.bandId)]
);

export const bandMember = sqliteTable(
	'band_member',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
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
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
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

export type Band = typeof band.$inferSelect;
export type BandMember = typeof bandMember.$inferSelect;
