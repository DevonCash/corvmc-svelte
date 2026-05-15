import { z } from 'zod';
import { query, command } from '$app/server';
import { getRequestEvent } from '$app/server';
import { requireStaff } from '$lib/server/authorization';
import {
	getCampaign,
	updateCampaign,
	deleteCampaign,
	sendNow,
	scheduleCampaign,
	renderCampaignPreview
} from '$lib/server/marketing/campaign-service';
import { listAudiences } from '$lib/server/marketing/audience-service';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getCampaignDetail = query(z.string(), async (id) => {
	await requireStaff();
	return getCampaign(id);
});

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

const updateSchema = z.object({
	subject: z.string().trim().min(1).max(500),
	markdownBody: z.string().min(1),
	audienceIds: z.array(z.string()).min(1).max(20)
});

export const saveDraft = command(updateSchema, async (data) => {
	await requireStaff();
	const { params } = getRequestEvent();
	const id = params.id!;
	await updateCampaign(id, data);
	void getCampaignDetail(id).refresh();
	return { success: true };
});

export const sendCampaignNow = command(z.object({}), async () => {
	await requireStaff();
	const { params } = getRequestEvent();
	await sendNow(params.id!);
	return { success: true };
});

const scheduleSchema = z.object({
	scheduledFor: z.string().transform((s) => new Date(s))
});

export const scheduleCampaignCommand = command(scheduleSchema, async (data) => {
	await requireStaff();
	const { params } = getRequestEvent();
	await scheduleCampaign(params.id!, data.scheduledFor);
	return { success: true };
});

export const deleteCampaignCommand = command(z.object({}), async () => {
	await requireStaff();
	const { params } = getRequestEvent();
	await deleteCampaign(params.id!);
	return { success: true };
});
