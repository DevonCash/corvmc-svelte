import { z } from 'zod';
import { query, command } from '$app/server';
import { getRequestEvent } from '$app/server';
import { requireStaff } from '$lib/server/authorization';
import {
	getCampaign,
	unscheduleCampaign
} from '$lib/server/marketing/campaign-service';

export const getCampaignDetail = query(z.string(), async (id) => {
	await requireStaff();
	return getCampaign(id);
});

export const unscheduleCommand = command(z.object({}), async () => {
	await requireStaff();
	const { params } = getRequestEvent();
	await unscheduleCampaign(params.id!);
	void getCampaignDetail(params.id!).refresh();
	return { success: true };
});
