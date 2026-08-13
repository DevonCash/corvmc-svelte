import { ServerClient } from 'postmark';
import { env } from '$env/dynamic/private';
import { captureException } from '$lib/server/sentry';

// ---------------------------------------------------------------------------
// Postmark email client
// ---------------------------------------------------------------------------
// Thin wrapper around the Postmark SDK. Lazily initialised on first use
// so the server token isn't required during build/test.
// ---------------------------------------------------------------------------

// Postmark message streams, read from the environment. These are custom streams
// rather than Postmark's defaults (`outbound` / `broadcast`), so both must exist
// with the configured ids on the server POSTMARK_SERVER_TOKEN belongs to —
// otherwise Postmark rejects every send. Required: there is no fallback.

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

function getBroadcastStream(): string {
	const stream = env.POSTMARK_BROADCAST_STREAM;
	if (!stream) throw new Error('POSTMARK_BROADCAST_STREAM is not configured');
	return stream;
}

function getTransactionalStream(): string {
	const stream = env.POSTMARK_TRANSACTIONAL_STREAM;
	if (!stream) throw new Error('POSTMARK_TRANSACTIONAL_STREAM is not configured');
	return stream;
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
	const messageStream = getBroadcastStream();

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
					MessageStream: messageStream
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
	/**
	 * Where a reply should go. Set it for any template the recipient can answer —
	 * From is `noreply@`, so without this their reply is silently lost. Templates
	 * that carry one are plaintext by convention (see postmark/templates).
	 */
	replyTo?: string | null;
	tag?: string;
	metadata?: Record<string, string>;
}

export async function sendEmailWithTemplate(params: SendTemplateParams): Promise<void> {
	const fromAddress = env.EMAIL_FROM_ADDRESS ?? 'noreply@corvmc.org';
	const fromName = env.EMAIL_FROM_NAME ?? 'CorvMC';
	const messageStream = getTransactionalStream();

	try {
		await getClient().sendEmailWithTemplate({
			From: `${fromName} <${fromAddress}>`,
			To: params.to,
			ReplyTo: params.replyTo ?? undefined,
			TemplateAlias: params.templateAlias,
			TemplateModel: params.model,
			Tag: params.tag,
			Metadata: params.metadata,
			MessageStream: messageStream
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
	/** Mustachio model: { subject, contactName, staffName, body } — `body` is plain text */
	model: Record<string, unknown>;
	/** Where the recipient's response should go — a plus-addressed thread address */
	replyTo?: string | null;
	/** Original Message-ID for In-Reply-To header */
	inReplyTo?: string | null;
	/** Accumulated References header for threading */
	references?: string | null;
	metadata?: Record<string, string>;
}

export async function sendInboxReply(params: SendInboxReplyTemplateParams): Promise<string> {
	const fromAddress = env.EMAIL_FROM_ADDRESS ?? 'noreply@corvmc.org';
	const fromName = env.EMAIL_FROM_NAME ?? 'CorvMC';
	const messageStream = getTransactionalStream();

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
			ReplyTo: params.replyTo ?? undefined,
			TemplateAlias: 'inbox-reply',
			TemplateModel: params.model,
			Tag: 'inbox-reply',
			Metadata: params.metadata,
			Headers: headers.length > 0 ? headers : undefined,
			MessageStream: messageStream
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
