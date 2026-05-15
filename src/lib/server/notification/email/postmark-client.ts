import { ServerClient } from 'postmark';
import { env } from '$env/dynamic/private';

// ---------------------------------------------------------------------------
// Postmark email client
// ---------------------------------------------------------------------------
// Thin wrapper around the Postmark SDK. Lazily initialised on first use
// so the server token isn't required during build/test.
// ---------------------------------------------------------------------------

let client: ServerClient | null = null;

function getClient(): ServerClient {
	if (client) return client;

	const token = env.POSTMARK_SERVER_TOKEN;
	if (!token) {
		throw new Error('POSTMARK_SERVER_TOKEN is not configured');
	}

	client = new ServerClient(token);
	return client;
}

export interface SendEmailParams {
	to: string;
	subject: string;
	htmlBody: string;
	textBody?: string;
	tag?: string;
	/** Metadata attached to the message for tracking in Postmark */
	metadata?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Broadcast batch sending (for marketing campaigns)
// ---------------------------------------------------------------------------

export interface BroadcastMessage {
	to: string;
	subject: string;
	htmlBody: string;
	tag?: string;
	metadata?: Record<string, string>;
}

const BATCH_SIZE = 500;

/**
 * Send a batch of emails via Postmark's broadcast message stream.
 * Automatically chunks into batches of 500 (Postmark's limit).
 */
export async function sendBroadcastBatch(messages: BroadcastMessage[]): Promise<void> {
	if (messages.length === 0) return;

	const fromAddress = env.EMAIL_FROM_ADDRESS ?? 'noreply@corvmc.com';
	const fromName = env.EMAIL_FROM_NAME ?? 'CorvMC';
	const from = `${fromName} <${fromAddress}>`;

	for (let i = 0; i < messages.length; i += BATCH_SIZE) {
		const chunk = messages.slice(i, i + BATCH_SIZE);

		try {
			await getClient().sendEmailBatch(
				chunk.map((msg) => ({
					From: from,
					To: msg.to,
					Subject: msg.subject,
					HtmlBody: msg.htmlBody,
					Tag: msg.tag,
					Metadata: msg.metadata,
					MessageStream: 'broadcast'
				}))
			);
		} catch (err) {
			console.error('[email] Broadcast batch failed:', {
				batchStart: i,
				batchSize: chunk.length,
				error: err
			});
			throw err;
		}
	}
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
	const fromAddress = env.EMAIL_FROM_ADDRESS ?? 'noreply@corvmc.com';
	const fromName = env.EMAIL_FROM_NAME ?? 'CorvMC';

	try {
		await getClient().sendEmail({
			From: `${fromName} <${fromAddress}>`,
			To: params.to,
			Subject: params.subject,
			HtmlBody: params.htmlBody,
			TextBody: params.textBody,
			Tag: params.tag,
			Metadata: params.metadata
		});
	} catch (err) {
		console.error('[email] Failed to send:', {
			to: params.to,
			subject: params.subject,
			error: err
		});
		throw err;
	}
}
