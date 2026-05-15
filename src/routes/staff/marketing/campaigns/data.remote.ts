import { z } from 'zod';
import { query, command } from '$app/server';
import { requireStaff } from '$lib/server/authorization';
import {
	listCampaigns,
	type CampaignStatus
} from '$lib/server/marketing/campaign-service';
import { listAudiences } from '$lib/server/marketing/audience-service';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

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

export const getAudienceOptions = query(z.void(), async () => {
	await requireStaff();
	return listAudiences();
});
