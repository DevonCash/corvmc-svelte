import { z } from 'zod';
import { query, command } from '$app/server';
import { getRequestEvent } from '$app/server';
import { requireStaff } from '$lib/server/authorization';
import {
	createCampaign,
	sendNow,
	scheduleCampaign,
	renderCampaignPreview
} from '$lib/server/marketing/campaign-service';
import { listAudiences } from '$lib/server/marketing/audience-service';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getAudienceOptions = query(z.void(), async () => {
	await requireStaff();
	return listAudiences();
});

export const getPreview = query(z.string(), async (markdown) => {
	await requireStaff();
	if (!markdown.trim()) return '';
	return renderCampaignPreview(markdown);
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const createSchema = z.object({
	subject: z.string().trim().min(1).max(500),
	markdownBody: z.string().min(1),
	audienceIds: z.array(z.string()).min(1).max(20)
});

export const createDraft = command(createSchema, async (data) => {
	const user = await requireStaff();
	const campaign = await createCampaign({
		...data,
		sentById: user.id
	});
	return { campaignId: campaign.id };
});

const createAndSendSchema = z.object({
	subject: z.string().trim().min(1).max(500),
	markdownBody: z.string().min(1),
	audienceIds: z.array(z.string()).min(1).max(20)
});

export const createAndSend = command(createAndSendSchema, async (data) => {
	const user = await requireStaff();
	const campaign = await createCampaign({
		...data,
		sentById: user.id
	});
	await sendNow(campaign.id);
	return { campaignId: campaign.id };
});

const createAndScheduleSchema = z.object({
	subject: z.string().trim().min(1).max(500),
	markdownBody: z.string().min(1),
	audienceIds: z.array(z.string()).min(1).max(20),
	scheduledFor: z.string().transform((s) => new Date(s))
});

export const createAndSchedule = command(createAndScheduleSchema, async (data) => {
	const user = await requireStaff();
	const campaign = await createCampaign({
		subject: data.subject,
		markdownBody: data.markdownBody,
		audienceIds: data.audienceIds,
		sentById: user.id
	});
	await scheduleCampaign(campaign.id, data.scheduledFor);
	return { campaignId: campaign.id };
});
