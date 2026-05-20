import { z } from 'zod';
import { query } from '$app/server';
import { requireStaff } from '$lib/server/authorization';
import { getCampaign } from '$lib/server/marketing/campaign-service';

export const getCampaignDetail = query(z.string(), async (id) => {
	await requireStaff();
	return getCampaign(id);
});
