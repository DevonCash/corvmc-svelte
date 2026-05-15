import {
	pgTable,
	text,
	timestamp,
	uuid,
	index,
	unique,
	boolean,
	integer,
	primaryKey
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth';

// ---------------------------------------------------------------------------
// Subscribers
// ---------------------------------------------------------------------------
// An email address that can appear on any number of audiences. Optionally
// linked to a user account via userId.
// ---------------------------------------------------------------------------

export const subscriber = pgTable(
	'subscriber',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		email: text('email').notNull().unique(),
		name: text('name'),
		userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('idx_subscriber_user').on(t.userId)]
);

// ---------------------------------------------------------------------------
// Audiences
// ---------------------------------------------------------------------------
// A named, staff-managed list of subscribers. Has a slug for public signup
// URLs. allowOptIn controls whether the audience appears on the public
// subscribe page and member account opt-in UI.
// ---------------------------------------------------------------------------

export const audience = pgTable('audience', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	slug: text('slug').notNull().unique(),
	description: text('description'),
	allowOptIn: boolean('allow_opt_in').notNull().default(false),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// ---------------------------------------------------------------------------
// Audience members
// ---------------------------------------------------------------------------
// Join between subscriber and audience with unsubscribe tracking.
// Active if unsubscribedAt is null.
// ---------------------------------------------------------------------------

export const audienceMember = pgTable(
	'audience_member',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		subscriberId: uuid('subscriber_id')
			.notNull()
			.references(() => subscriber.id, { onDelete: 'cascade' }),
		audienceId: uuid('audience_id')
			.notNull()
			.references(() => audience.id, { onDelete: 'cascade' }),
		unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		unique('uq_audience_member').on(t.subscriberId, t.audienceId),
		index('idx_audience_member_active').on(t.audienceId).where(sql`unsubscribed_at IS NULL`)
	]
);

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------
// A markdown email composed by staff, targeting one or more audiences.
// Status is derived from timestamps:
//   Draft:     scheduledFor is null, sentAt is null
//   Scheduled: scheduledFor is set and in the future
//   Sending:   scheduledFor is past, sentAt is null
//   Sent:      sentAt is set
// ---------------------------------------------------------------------------

export const campaign = pgTable(
	'campaign',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		subject: text('subject').notNull(),
		markdownBody: text('markdown_body').notNull(),
		htmlBody: text('html_body').notNull(),
		scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
		sentAt: timestamp('sent_at', { withTimezone: true }),
		sentById: text('sent_by_id')
			.notNull()
			.references(() => user.id),
		recipientCount: integer('recipient_count'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('idx_campaign_pending_send').on(t.scheduledFor).where(sql`sent_at IS NULL`),
		index('idx_campaign_sent_by').on(t.sentById)
	]
);

// ---------------------------------------------------------------------------
// Campaign ↔ Audience join
// ---------------------------------------------------------------------------

export const campaignAudience = pgTable(
	'campaign_audience',
	{
		campaignId: uuid('campaign_id')
			.notNull()
			.references(() => campaign.id, { onDelete: 'cascade' }),
		audienceId: uuid('audience_id')
			.notNull()
			.references(() => audience.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.campaignId, t.audienceId] })]
);
