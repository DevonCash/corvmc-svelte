import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { handlePostmarkInbound, type PostmarkInboundPayload } from '$lib/server/inbox/inbound-handlers';

export const POST: RequestHandler = async ({ request }) => {
	const token = request.headers.get('x-postmark-token');
	const expectedToken = env.POSTMARK_INBOUND_TOKEN;

	if (expectedToken && token !== expectedToken) {
		error(401, 'Invalid inbound token');
	}

	let payload: PostmarkInboundPayload;
	try {
		payload = await request.json();
	} catch {
		error(400, 'Invalid JSON body');
	}

	if (!payload.From && !payload.FromFull?.Email) {
		error(400, 'Missing sender information');
	}

	if (!payload.TextBody && !payload.HtmlBody) {
		error(400, 'Missing message body');
	}

	try {
		await handlePostmarkInbound(payload);
	} catch (err) {
		console.error('[inbox/postmark] Webhook handler failed:', err);
		if (import.meta.env.DEV) throw err;
	}

	return json({ ok: true });
};
