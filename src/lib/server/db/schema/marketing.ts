import { sqliteTable, text, integer, index, unique, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { timestamp, uuid } from './columns';
import { user } from './auth';

// ---------------------------------------------------------------------------
// Subscribers
// ---------------------------------------------------------------------------

export const subscriber = sqliteTable(
	'subscriber',
	{
		id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		email: text('email').notNull().unique(),
		name: text('name'),
		userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at').notNull().default(sql`(current_timestamp)`)
	},
	(t) => [index('idx_subscriber_user').on(t.userId)]
);

// ---------------------------------------------------------------------------
// Audiences
// ---------------------------------------------------------------------------

export const audience = sqliteTable('audience', {
	id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	slug: text('slug').notNull().unique(),
	description: text('description'),
	allowOptIn: integer('allow_opt_in', { mode: 'boolean' }).notNull().default(false),
	createdAt: timestamp('created_at').notNull().default(sql`(current_timestamp)`)
});

// ---------------------------------------------------------------------------
// Audience members
// ---------------------------------------------------------------------------

export const audienceMember = sqliteTable(
	'audience_member',
	{
		id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		subscriberId: text('subscriber_id')
			.notNull()
			.references(() => subscriber.id, { onDelete: 'cascade' }),
		audienceId: text('audience_id')
			.notNull()
			.references(() => audience.id, { onDelete: 'cascade' }),
		unsubscribedAt: timestamp('unsubscribed_at'),
		createdAt: timestamp('created_at').notNull().default(sql`(current_timestamp)`)
	},
	(t) => [
		unique('uq_audience_member').on(t.subscriberId, t.audienceId),
		index('idx_audience_member_active').on(t.audienceId).where(sql`unsubscribed_at IS NULL`)
	]
);

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export const campaign = sqliteTable(
	'campaign',
	{
		id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		subject: text('subject').notNull(),
		markdownBody: text('markdown_body').notNull(),
		htmlBody: text('html_body').notNull(),
		scheduledFor: timestamp('scheduled_for'),
		sentAt: timestamp('sent_at'),
		sentById: text('sent_by_id')
			.notNull()
			.references(() => user.id),
		recipientCount: integer('recipient_count'),
		createdAt: timestamp('created_at').notNull().default(sql`(current_timestamp)`),
		updatedAt: timestamp('updated_at').notNull().default(sql`(current_timestamp)`)
	},
	(t) => [
		index('idx_campaign_pending_send').on(t.scheduledFor).where(sql`sent_at IS NULL`),
		index('idx_campaign_sent_by').on(t.sentById)
	]
);

// ---------------------------------------------------------------------------
// Campaign ↔ Audience join
// ---------------------------------------------------------------------------

export const campaignAudience = sqliteTable(
	'campaign_audience',
	{
		campaignId: text('campaign_id')
			.notNull()
			.references(() => campaign.id, { onDelete: 'cascade' }),
		audienceId: text('audience_id')
			.notNull()
			.references(() => audience.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.campaignId, t.audienceId] })]
);
