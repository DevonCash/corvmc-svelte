import { db } from '$lib/server/db';
import {
	campaign,
	campaignAudience,
	audience,
	audienceMember,
	subscriber
} from '$lib/server/db/schema/marketing';
import { eq, and, sql, isNull, lte, inArray } from 'drizzle-orm';
import { renderCampaignPreview, renderCampaignForSend } from './campaign-render';
import { signUnsubscribeToken } from './unsubscribe';
import { sendBroadcastBatch, type BroadcastMessage } from '$lib/server/notification/email';
import { env } from '$env/dynamic/private';

// ---------------------------------------------------------------------------
// Campaign service
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Derived status helper
// ---------------------------------------------------------------------------

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent';

export function deriveCampaignStatus(
	scheduledFor: Date | null,
	sentAt: Date | null
): CampaignStatus {
	if (sentAt) return 'sent';
	if (!scheduledFor) return 'draft';
	if (scheduledFor > new Date()) return 'scheduled';
	return 'sending';
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createCampaign(data: {
	subject: string;
	markdownBody: string;
	audienceIds: string[];
	sentById: string;
}) {
	if (data.subject.length > 500) throw new Error('Subject too long (max 500)');
	if (data.audienceIds.length === 0) throw new Error('At least one audience is required');
	if (data.audienceIds.length > 20) throw new Error('Too many audiences (max 20)');

	const htmlBody = renderCampaignPreview(data.markdownBody);

	const [created] = await db
		.insert(campaign)
		.values({
			subject: data.subject,
			markdownBody: data.markdownBody,
			htmlBody,
			sentById: data.sentById
		})
		.returning();

	if (data.audienceIds.length > 0) {
		await db.insert(campaignAudience).values(
			data.audienceIds.map((audienceId) => ({
				campaignId: created.id,
				audienceId
			}))
		);
	}

	return created;
}

export async function updateCampaign(
	id: string,
	data: { subject?: string; markdownBody?: string; audienceIds?: string[] }
) {
	const existing = await getCampaignRaw(id);
	if (!existing) throw new Error('Campaign not found');

	const status = deriveCampaignStatus(existing.scheduledFor, existing.sentAt);
	if (status !== 'draft') throw new Error('Can only edit draft campaigns');

	if (data.subject !== undefined && data.subject.length > 500) throw new Error('Subject too long (max 500)');
	if (data.audienceIds !== undefined && data.audienceIds.length === 0) throw new Error('At least one audience is required');
	if (data.audienceIds !== undefined && data.audienceIds.length > 20) throw new Error('Too many audiences (max 20)');

	const updates: Record<string, unknown> = { updatedAt: new Date() };
	if (data.subject !== undefined) updates.subject = data.subject;
	if (data.markdownBody !== undefined) {
		updates.markdownBody = data.markdownBody;
		updates.htmlBody = renderCampaignPreview(data.markdownBody);
	}

	const [updated] = await db
		.update(campaign)
		.set(updates)
		.where(eq(campaign.id, id))
		.returning();

	if (data.audienceIds !== undefined) {
		await db.delete(campaignAudience).where(eq(campaignAudience.campaignId, id));
		if (data.audienceIds.length > 0) {
			await db.insert(campaignAudience).values(
				data.audienceIds.map((audienceId) => ({
					campaignId: id,
					audienceId
				}))
			);
		}
	}

	return updated;
}

export async function deleteCampaign(id: string) {
	const existing = await getCampaignRaw(id);
	if (!existing) throw new Error('Campaign not found');

	const status = deriveCampaignStatus(existing.scheduledFor, existing.sentAt);
	if (status !== 'draft') throw new Error('Can only delete draft campaigns');

	await db.delete(campaign).where(eq(campaign.id, id));
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

async function getCampaignRaw(id: string) {
	const [row] = await db.select().from(campaign).where(eq(campaign.id, id)).limit(1);
	return row ?? null;
}

export async function getCampaign(id: string) {
	const [row] = await db
		.select()
		.from(campaign)
		.where(eq(campaign.id, id))
		.limit(1);

	if (!row) return null;

	const audiences = await db
		.select({
			id: audience.id,
			name: audience.name
		})
		.from(campaignAudience)
		.innerJoin(audience, eq(audience.id, campaignAudience.audienceId))
		.where(eq(campaignAudience.campaignId, id));

	return {
		...row,
		status: deriveCampaignStatus(row.scheduledFor, row.sentAt),
		audiences
	};
}

export async function listCampaigns(statusFilter?: CampaignStatus) {
	const rows = await db
		.select({
			id: campaign.id,
			subject: campaign.subject,
			scheduledFor: campaign.scheduledFor,
			sentAt: campaign.sentAt,
			sentById: campaign.sentById,
			recipientCount: campaign.recipientCount,
			createdAt: campaign.createdAt,
			updatedAt: campaign.updatedAt
		})
		.from(campaign)
		.orderBy(sql`coalesce(${campaign.sentAt}, ${campaign.scheduledFor}, ${campaign.createdAt}) desc`);

	// Join audience names per campaign
	const campaignIds = rows.map((r) => r.id);
	const audienceRows =
		campaignIds.length > 0
			? await db
					.select({
						campaignId: campaignAudience.campaignId,
						audienceName: audience.name
					})
					.from(campaignAudience)
					.innerJoin(audience, eq(audience.id, campaignAudience.audienceId))
					.where(inArray(campaignAudience.campaignId, campaignIds))
			: [];

	const audienceMap = new Map<string, string[]>();
	for (const ar of audienceRows) {
		const list = audienceMap.get(ar.campaignId) ?? [];
		list.push(ar.audienceName);
		audienceMap.set(ar.campaignId, list);
	}

	const result = rows.map((r) => ({
		...r,
		status: deriveCampaignStatus(r.scheduledFor, r.sentAt),
		audienceNames: audienceMap.get(r.id) ?? []
	}));

	if (statusFilter) {
		return result.filter((r) => r.status === statusFilter);
	}

	return result;
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

export async function scheduleCampaign(id: string, scheduledFor: Date) {
	const existing = await getCampaignRaw(id);
	if (!existing) throw new Error('Campaign not found');

	const status = deriveCampaignStatus(existing.scheduledFor, existing.sentAt);
	if (status !== 'draft') throw new Error('Can only schedule draft campaigns');
	if (scheduledFor <= new Date()) throw new Error('Scheduled time must be in the future');

	await db
		.update(campaign)
		.set({ scheduledFor, updatedAt: new Date() })
		.where(eq(campaign.id, id));
}

export async function unscheduleCampaign(id: string) {
	const existing = await getCampaignRaw(id);
	if (!existing) throw new Error('Campaign not found');

	const status = deriveCampaignStatus(existing.scheduledFor, existing.sentAt);
	if (status !== 'scheduled') throw new Error('Can only unschedule scheduled campaigns');

	await db
		.update(campaign)
		.set({ scheduledFor: null, updatedAt: new Date() })
		.where(eq(campaign.id, id));
}

export async function sendNow(id: string) {
	const existing = await getCampaignRaw(id);
	if (!existing) throw new Error('Campaign not found');

	const status = deriveCampaignStatus(existing.scheduledFor, existing.sentAt);
	if (status !== 'draft') throw new Error('Can only send draft campaigns');

	// Set scheduledFor to now — executeSend picks it up
	await db
		.update(campaign)
		.set({ scheduledFor: new Date(), updatedAt: new Date() })
		.where(eq(campaign.id, id));

	// Execute inline rather than waiting for cron
	await executeSend(id);
}

// ---------------------------------------------------------------------------
// Recipient resolution
// ---------------------------------------------------------------------------

export async function getRecipientsForCampaign(campaignId: string) {
	// Get audience IDs for this campaign
	const audienceIds = (
		await db
			.select({ audienceId: campaignAudience.audienceId })
			.from(campaignAudience)
			.where(eq(campaignAudience.campaignId, campaignId))
	).map((r) => r.audienceId);

	if (audienceIds.length === 0) return [];

	// Get all active subscribers across those audiences, deduplicated by email
	const rows = await db
		.selectDistinct({
			subscriberId: subscriber.id,
			email: subscriber.email,
			name: subscriber.name,
			audienceId: audienceMember.audienceId
		})
		.from(audienceMember)
		.innerJoin(subscriber, eq(subscriber.id, audienceMember.subscriberId))
		.where(
			and(
				inArray(audienceMember.audienceId, audienceIds),
				isNull(audienceMember.unsubscribedAt)
			)
		);

	return rows;
}

// ---------------------------------------------------------------------------
// Send execution
// ---------------------------------------------------------------------------

/**
 * Execute the actual send for a campaign. Resolves recipients,
 * renders per-recipient emails, and sends via Postmark broadcast stream.
 */
export async function executeSend(campaignId: string): Promise<number> {
	const row = await getCampaignRaw(campaignId);
	if (!row) throw new Error('Campaign not found');
	if (row.sentAt) throw new Error('Campaign already sent');

	const recipients = await getRecipientsForCampaign(campaignId);
	if (recipients.length === 0) {
		// Mark as sent with 0 recipients
		await db
			.update(campaign)
			.set({ sentAt: new Date(), recipientCount: 0, updatedAt: new Date() })
			.where(eq(campaign.id, campaignId));
		return 0;
	}

	const baseUrl = env.PUBLIC_BASE_URL ?? 'https://corvmc.com';

	const messages: BroadcastMessage[] = recipients.map((r) => {
		const unsubscribeUrl = `${baseUrl}/unsubscribe/${signUnsubscribeToken(r.subscriberId, r.audienceId)}`;
		const htmlBody = renderCampaignForSend(row.markdownBody, r.name, unsubscribeUrl);
		return {
			to: r.email,
			subject: row.subject,
			htmlBody,
			tag: 'campaign',
			metadata: { campaignId }
		};
	});

	await sendBroadcastBatch(messages);

	await db
		.update(campaign)
		.set({
			sentAt: new Date(),
			recipientCount: recipients.length,
			updatedAt: new Date()
		})
		.where(eq(campaign.id, campaignId));

	return recipients.length;
}

// ---------------------------------------------------------------------------
// Cron: process due campaigns
// ---------------------------------------------------------------------------

/**
 * Find and send all campaigns that are due (scheduledFor <= now, sentAt is null).
 * Returns the number of campaigns processed.
 */
export async function processDueCampaigns(): Promise<number> {
	const due = await db
		.select({ id: campaign.id })
		.from(campaign)
		.where(
			and(
				lte(campaign.scheduledFor, new Date()),
				isNull(campaign.sentAt)
			)
		);

	for (const row of due) {
		try {
			await executeSend(row.id);
		} catch (err) {
			console.error(`[campaign] Failed to send campaign ${row.id}:`, err);
		}
	}

	return due.length;
}

// ---------------------------------------------------------------------------
// Preview helper (for the editor)
// ---------------------------------------------------------------------------

export { renderCampaignPreview } from './campaign-render';
