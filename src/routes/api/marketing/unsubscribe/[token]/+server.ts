import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyUnsubscribeToken } from '$lib/server/marketing/unsubscribe';
import { unsubscribe, getAudience } from '$lib/server/marketing/audience-service';
import type { UnsubscribeResponse } from '$lib/server/db/schema/api';

export const GET: RequestHandler = async ({ params }) => {
	const decoded = verifyUnsubscribeToken(params.token);
	if (!decoded) {
		return json({ valid: false, audienceName: null } satisfies UnsubscribeResponse);
	}

	const audience = await getAudience(decoded.audienceId);
	if (!audience) {
		return json({ valid: false, audienceName: null } satisfies UnsubscribeResponse);
	}

	// Perform the unsubscribe
	await unsubscribe(decoded.subscriberId, decoded.audienceId);

	return json({
		valid: true,
		audienceName: audience.name
	} satisfies UnsubscribeResponse);
};
