import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyUnsubscribeToken } from '$lib/server/marketing/unsubscribe';
import { unsubscribe, getAudience } from '$lib/server/marketing/audience-service';

export const GET: RequestHandler = async ({ params }) => {
	const decoded = verifyUnsubscribeToken(params.token);
	if (!decoded) {
		return json({ valid: false as const, audienceName: null });
	}

	const audience = await getAudience(decoded.audienceId);
	if (!audience) {
		return json({ valid: false as const, audienceName: null });
	}

	// Perform the unsubscribe
	await unsubscribe(decoded.subscriberId, decoded.audienceId);

	return json({
		valid: true as const,
		audienceName: audience.name
	});
};
