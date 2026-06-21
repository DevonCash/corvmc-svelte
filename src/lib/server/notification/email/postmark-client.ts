import { ServerClient } from 'postmark';
import { env } from '$env/dynamic/private';
import { captureException } from '$lib/server/sentry';

// ---------------------------------------------------------------------------
// Postmark email client
// ---------------------------------------------------------------------------
// Thin wrapper around the Postmark SDK. Lazily initialised on first use
// so the server token isn't required during build/test.
// ---------------------------------------------------------------------------

// Postmark message streams. Both must exist on the configured server.
const BROADCAST_STREAM = 'corvmc-broadcast';
const TRANSACTIONAL_STREAM = 'corvmc-transactional';

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

// ---------------------------------------------------------------------------
// Broadcast batch sending (for marketing campaigns)
// ---------------------------------------------------------------------------

export interface BroadcastMessage {
	to: string;
	subject: string;
	htmlBody: string;
	tag?: string;
	metadata?: Record<string, string>;
	headers?: { Name: string; Value: string }[];
}

const BATCH_SIZE = 500;

/**
 * Send a batch of emails via Postmark's broadcast message stream.
 * Automatically chunks into batches of 500 (Postmark's limit).
 */
export async function sendBroadcastBatch(messages: BroadcastMessage[]): Promise<void> {
	if (messages.length === 0) return;

	const fromAddress = env.EMAIL_FROM_ADDRESS ?? 'noreply@corvmc.org';
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
					Headers: msg.headers,
					MessageStream: BROADCAST_STREAM
				}))
			);
		} catch (err) {
			captureException(err, {
				event: 'email.send',
				kind: 'broadcast_batch',
				batchStart: i,
				batchSize: chunk.length
			});
			throw err;
		}
	}
}

// ---------------------------------------------------------------------------
// Template-based sending (Postmark-hosted templates)
// ---------------------------------------------------------------------------
// Transactional notifications render from templates stored in Postmark (source
// of truth in postmark/templates, pushed via `pnpm email:push`). Most use the
// generic `notification` template, whose subject + body come from the model.

export interface SendTemplateParams {
	to: string;
	/** Postmark template alias, e.g. 'ticket-confirmation' */
	templateAlias: string;
	/** Mustachio model — values substituted into the template */
	model: Record<string, unknown>;
	tag?: string;
	metadata?: Record<string, string>;
}

export async function sendEmailWithTemplate(params: SendTemplateParams): Promise<void> {
	const fromAddress = env.EMAIL_FROM_ADDRESS ?? 'noreply@corvmc.org';
	const fromName = env.EMAIL_FROM_NAME ?? 'CorvMC';

	try {
		await getClient().sendEmailWithTemplate({
			From: `${fromName} <${fromAddress}>`,
			To: params.to,
			TemplateAlias: params.templateAlias,
			TemplateModel: params.model,
			Tag: params.tag,
			Metadata: params.metadata,
			MessageStream: TRANSACTIONAL_STREAM
		});
	} catch (err) {
		captureException(err, {
			event: 'email.send',
			kind: 'template',
			to: params.to,
			templateAlias: params.templateAlias,
			tag: params.tag
		});
		throw err;
	}
}

// ---------------------------------------------------------------------------
// Inbox reply sending (with email threading headers)
// ---------------------------------------------------------------------------

export interface SendInboxReplyTemplateParams {
	to: string;
	/** Mustachio model: { subject, contactName, staffName, body } (body is unescaped HTML) */
	model: Record<string, unknown>;
	/** Original Message-ID for In-Reply-To header */
	inReplyTo?: string | null;
	/** Accumulated References header for threading */
	references?: string | null;
	metadata?: Record<string, string>;
}

export async function sendInboxReply(params: SendInboxReplyTemplateParams): Promise<string> {
	const fromAddress = env.EMAIL_FROM_ADDRESS ?? 'noreply@corvmc.org';
	const fromName = env.EMAIL_FROM_NAME ?? 'CorvMC';

	const headers: Array<{ Name: string; Value: string }> = [];
	if (params.inReplyTo) {
		headers.push({ Name: 'In-Reply-To', Value: params.inReplyTo });
	}
	if (params.references) {
		headers.push({ Name: 'References', Value: params.references });
	}

	try {
		const result = await getClient().sendEmailWithTemplate({
			From: `${fromName} <${fromAddress}>`,
			To: params.to,
			TemplateAlias: 'inbox-reply',
			TemplateModel: params.model,
			Tag: 'inbox-reply',
			Metadata: params.metadata,
			Headers: headers.length > 0 ? headers : undefined,
			MessageStream: TRANSACTIONAL_STREAM
		});
		return result.MessageID;
	} catch (err) {
		captureException(err, {
			event: 'email.send',
			kind: 'inbox_reply',
			to: params.to
		});
		throw err;
	}
}
