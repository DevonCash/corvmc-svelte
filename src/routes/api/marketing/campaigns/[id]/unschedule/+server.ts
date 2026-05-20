import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { unscheduleCampaign } from '$lib/server/marketing/campaign-service';

export const POST: RequestHandler = async ({ params, locals }) => {
	await requireStaffRole(locals.user?.id);
	await unscheduleCampaign(params.id);
	return json({ success: true });
};
