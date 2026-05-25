import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, form, command, getRequestEvent } from '$app/server';
import { requireStaff } from '$lib/server/authorization';
import {
	listAudiences,
	getAudience,
	getAudienceBySlug,
	getOptInAudiences,
	createAudience as createAudienceService,
	updateAudience as updateAudienceService,
	deleteAudience as deleteAudienceService,
	addSubscriber as addSubscriberService,
	removeSubscriber as removeSubscriberService,
	unsubscribe,
	bulkAddMembers as bulkAddMembersService,
	listSubscribers
} from '$lib/server/marketing/audience-service';
import {
	listCampaigns,
	getCampaign,
	createCampaign,
	updateCampaign,
	deleteCampaign as deleteCampaignService,
	sendNow,
	scheduleCampaign as scheduleCampaignService,
	unscheduleCampaign as unscheduleCampaignService,
	renderCampaignPreview,
	type CampaignStatus
} from '$lib/server/marketing/campaign-service';
import { findOrCreateByEmail } from '$lib/server/marketing/subscriber-service';
import { verifyUnsubscribeToken } from '$lib/server/marketing/unsubscribe';
import { generateSlug, ensureUniqueSlug } from '$lib/server/utils/slug';
import { audience } from '$lib/server/db/schema/marketing';

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------

export const getPublicAudienceBySlug = query(z.string(), async (slug) => {
	const aud = await getAudienceBySlug(slug);
	if (!aud || !aud.allowOptIn) throw error(404, 'List not found');
	return {
		audience: {
			id: aud.id,
			name: aud.name,
			slug: aud.slug,
			description: aud.description
		}
	};
});

export const subscribeToAudience = form(
	z.object({ slug: z.string(), email: z.string().email(), name: z.string().optional() }),
	async (data) => {
		const aud = await getAudienceBySlug(data.slug);
		if (!aud || !aud.allowOptIn) throw error(404, 'List not found');
		const sub = await findOrCreateByEmail(data.email.trim().toLowerCase(), data.name?.trim());
		await addSubscriberService(aud.id, sub.id);
		return { success: true };
	}
);

export const getUnsubscribeInfo = query(z.string(), async (token) => {
	const decoded = verifyUnsubscribeToken(token);
	if (!decoded) return { valid: false as const, audienceName: null };

	const aud = await getAudience(decoded.audienceId);
	if (!aud) return { valid: false as const, audienceName: null };

	await unsubscribe(decoded.subscriberId, decoded.audienceId);
	return { valid: true as const, audienceName: aud.name };
});

// ---------------------------------------------------------------------------
// Staff queries
// ---------------------------------------------------------------------------

/** List all audiences (staff). Used on audiences index and as audience options. */
export const getAudiences = query(z.void(), async () => {
	await requireStaff();
	return listAudiences();
});

/** Alias for getAudiences, used in campaign editor audience pickers. */
export const getAudienceOptions = getAudiences;

/** Public: opt-in audiences (no auth required). */
export const getPublicAudiences = query(z.void(), async () => {
	return getOptInAudiences();
});

/** Single audience detail (staff). */
export const getAudienceDetail = query(z.string(), async (id) => {
	await requireStaff();
	return getAudience(id);
});

/** List subscribers for an audience. */
export const getAudienceSubscribers = query(z.string(), async (audienceId) => {
	await requireStaff();
	return listSubscribers(audienceId);
});

/** List campaigns with optional status filter. */
export const getCampaigns = query(
	z.object({ status: z.string().optional() }),
	async (filters) => {
		await requireStaff();
		const statusFilter = ['draft', 'scheduled', 'sending', 'sent'].includes(filters.status ?? '')
			? (filters.status as CampaignStatus)
			: undefined;
		return listCampaigns(statusFilter);
	}
);

/** Single campaign detail (staff). */
export const getCampaignDetail = query(z.string(), async (id) => {
	await requireStaff();
	return getCampaign(id);
});

/** Render markdown to campaign HTML preview. */
export const getPreview = query(z.string(), async (markdown) => {
	await requireStaff();
	if (!markdown.trim()) return '';
	return renderCampaignPreview(markdown);
});

// ---------------------------------------------------------------------------
// Forms — Audiences
// ---------------------------------------------------------------------------

export const createAudience = form(
	z.object({
		name: z.string().min(1).max(255),
		slug: z.string().max(100).optional(),
		description: z.string().max(2000).optional(),
		allowOptIn: z.string().optional()
	}),
	async (data, issue) => {
		await requireStaff();

		const name = (data.name as string).trim();
		if (!name) {
			issue.name('Name is required');
			return;
		}

		const baseSlug = (data.slug as string)?.trim() || generateSlug(name);
		const slug = await ensureUniqueSlug(baseSlug, audience, audience.slug);

		const created = await createAudienceService({
			name,
			slug,
			description: (data.description as string)?.trim() || undefined,
			allowOptIn: data.allowOptIn === 'true' || data.allowOptIn === 'on'
		});

		void getAudiences().refresh();
		return { audienceId: created.id };
	}
);

export const updateAudience = form(
	z.object({
		id: z.string(),
		name: z.string().max(255).optional(),
		description: z.string().max(2000).optional(),
		allowOptIn: z.string().optional()
	}),
	async (data) => {
		await requireStaff();

		const id = data.id as string;
		await updateAudienceService(id, {
			name: data.name ? (data.name as string).trim() : undefined,
			description: data.description !== undefined ? (data.description as string).trim() : undefined,
			allowOptIn:
				data.allowOptIn !== undefined
					? data.allowOptIn === 'true' || data.allowOptIn === 'on'
					: undefined
		});

		void getAudienceDetail(id).refresh();
		return { success: true };
	}
);

export const deleteAudience = form(
	z.object({
		id: z.string()
	}),
	async (data) => {
		await requireStaff();
		await deleteAudienceService(data.id as string);
		void getAudiences().refresh();
		return { success: true };
	}
);

export const bulkAddMembers = form(
	z.object({
		audienceId: z.string()
	}),
	async (data) => {
		await requireStaff();
		const count = await bulkAddMembersService(data.audienceId as string);
		void getAudienceSubscribers(data.audienceId as string).refresh();
		void getAudienceDetail(data.audienceId as string).refresh();
		return { added: count };
	}
);

export const addSubscriber = form(
	z.object({
		audienceId: z.string(),
		email: z.string().email(),
		name: z.string().max(255).optional()
	}),
	async (data, issue) => {
		await requireStaff();

		const email = (data.email as string).trim();
		if (!email) {
			issue.email('Email is required');
			return;
		}

		const sub = await findOrCreateByEmail(email, (data.name as string)?.trim() || undefined);
		await addSubscriberService(data.audienceId as string, sub.id);

		void getAudienceSubscribers(data.audienceId as string).refresh();
		void getAudienceDetail(data.audienceId as string).refresh();
		return { success: true };
	}
);

export const removeSubscriber = form(
	z.object({
		audienceId: z.string(),
		subscriberId: z.string()
	}),
	async (data) => {
		await requireStaff();
		await removeSubscriberService(data.audienceId as string, data.subscriberId as string);
		void getAudienceSubscribers(data.audienceId as string).refresh();
		void getAudienceDetail(data.audienceId as string).refresh();
		return { success: true };
	}
);

// ---------------------------------------------------------------------------
// Forms — Campaigns
// ---------------------------------------------------------------------------

export const createDraft = command(
	z.object({
		subject: z.string().trim().min(1).max(500),
		markdownBody: z.string().min(1),
		audienceIds: z.array(z.string()).min(1).max(20)
	}),
	async (data) => {
		const user = await requireStaff();
		const campaign = await createCampaign({
			...data,
			sentById: user.id
		});
		return { campaignId: campaign.id };
	}
);

export const createAndSend = command(
	z.object({
		subject: z.string().trim().min(1).max(500),
		markdownBody: z.string().min(1),
		audienceIds: z.array(z.string()).min(1).max(20)
	}),
	async (data) => {
		const user = await requireStaff();
		const campaign = await createCampaign({
			...data,
			sentById: user.id
		});
		await sendNow(campaign.id);
		return { campaignId: campaign.id };
	}
);

export const createAndSchedule = command(
	z.object({
		subject: z.string().trim().min(1).max(500),
		markdownBody: z.string().min(1),
		audienceIds: z.array(z.string()).min(1).max(20),
		scheduledFor: z.string().transform((s) => new Date(s))
	}),
	async (data) => {
		const user = await requireStaff();
		const campaign = await createCampaign({
			subject: data.subject,
			markdownBody: data.markdownBody,
			audienceIds: data.audienceIds,
			sentById: user.id
		});
		await scheduleCampaignService(campaign.id, data.scheduledFor);
		return { campaignId: campaign.id };
	}
);

export const saveDraft = command(
	z.object({
		subject: z.string().trim().min(1).max(500),
		markdownBody: z.string().min(1),
		audienceIds: z.array(z.string()).min(1).max(20)
	}),
	async (data) => {
		await requireStaff();
		const { params } = getRequestEvent();
		const id = params.id!;
		await updateCampaign(id, data);
		void getCampaignDetail(id).refresh();
		return { success: true };
	}
);

export const sendCampaignNow = command(z.object({}), async () => {
	await requireStaff();
	const { params } = getRequestEvent();
	await sendNow(params.id!);
	return { success: true };
});

export const scheduleCampaign = command(
	z.object({
		scheduledFor: z.string().transform((s) => new Date(s))
	}),
	async (data) => {
		await requireStaff();
		const { params } = getRequestEvent();
		await scheduleCampaignService(params.id!, data.scheduledFor);
		return { success: true };
	}
);

export const deleteCampaign = command(z.object({}), async () => {
	await requireStaff();
	const { params } = getRequestEvent();
	await deleteCampaignService(params.id!);
	return { success: true };
});

export const unscheduleCampaign = form(
	z.object({
		campaignId: z.string()
	}),
	async (data) => {
		await requireStaff();
		await unscheduleCampaignService(data.campaignId as string);
		void getCampaignDetail(data.campaignId as string).refresh();
		return { success: true };
	}
);
