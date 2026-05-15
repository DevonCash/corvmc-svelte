import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { verifyUnsubscribeToken } from '$lib/server/marketing/unsubscribe';
import { unsubscribe, getAudience } from '$lib/server/marketing/audience-service';

export const load: PageServerLoad = async ({ params }) => {
	const decoded = verifyUnsubscribeToken(params.token);
	if (!decoded) {
		return { valid: false as const, audienceName: null };
	}

	const audience = await getAudience(decoded.audienceId);
	if (!audience) {
		return { valid: false as const, audienceName: null };
	}

	// Perform the unsubscribe
	await unsubscribe(decoded.subscriberId, decoded.audienceId);

	return {
		valid: true as const,
		audienceName: audience.name
	};
};
