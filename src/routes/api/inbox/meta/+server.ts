import { json, error, text } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { handleMetaInbound } from '$lib/server/inbox/inbound-handlers';

async function verifySignature(body: string, signature: string): Promise<boolean> {
	const secret = env.META_APP_SECRET;
	if (!secret) return false;

	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);

	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
	const expected = 'sha256=' + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

	return expected === signature;
}

export const GET: RequestHandler = async ({ url }) => {
	const mode = url.searchParams.get('hub.mode');
	const token = url.searchParams.get('hub.verify_token');
	const challenge = url.searchParams.get('hub.challenge');

	const verifyToken = env.META_VERIFY_TOKEN;

	if (mode === 'subscribe' && token === verifyToken && challenge) {
		return text(challenge);
	}

	error(403, 'Verification failed');
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.text();

	const signature = request.headers.get('x-hub-signature-256') ?? '';
	if (signature) {
		const valid = await verifySignature(body, signature);
		if (!valid) {
			error(403, 'Invalid signature');
		}
	} else if (!import.meta.env.DEV) {
		error(403, 'Missing signature');
	}

	let payload: MetaWebhookPayload;
	try {
		payload = JSON.parse(body);
	} catch {
		error(400, 'Invalid JSON body');
	}

	const channel: 'instagram' | 'messenger' =
		payload.object === 'instagram' ? 'instagram' : 'messenger';

	for (const entry of payload.entry ?? []) {
		for (const event of entry.messaging ?? []) {
			if (!event.message?.text) continue;

			try {
				await handleMetaInbound({
					channel,
					senderId: event.sender?.id ?? '',
					messageId: event.message.mid ?? '',
					text: event.message.text,
					timestamp: event.timestamp ?? Date.now()
				});
			} catch (err) {
				console.error(`[inbox/meta] Failed to handle ${channel} message:`, err);
				if (import.meta.env.DEV) throw err;
			}
		}
	}

	return json({ ok: true });
};

interface MetaWebhookPayload {
	object: string;
	entry?: Array<{
		id: string;
		time: number;
		messaging?: Array<{
			sender?: { id: string };
			recipient?: { id: string };
			timestamp?: number;
			message?: {
				mid?: string;
				text?: string;
			};
		}>;
	}>;
}
