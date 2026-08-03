import { findOrCreateThread, findThreadById, reopenThread } from './thread-service';
import { addInboundMessage } from './message-service';
import { parseReplyMailboxHash } from './reply-address';
import { isChannelEnabled } from './channel-config-service';
import { domainEvents } from '$lib/server/events/event-bus';

export interface ContactFormParams {
	name: string;
	email: string;
	subject: string;
	message: string;
}

export async function handleContactForm(params: ContactFormParams) {
	const thread = await findOrCreateThread({
		channel: 'web',
		contactName: params.name,
		contactEmail: params.email,
		subject: params.subject
	});

	const message = await addInboundMessage({
		threadId: thread.id,
		body: params.message,
		authorName: params.name
	});

	domainEvents.emit('contact.form_submitted', {
		threadId: thread.id,
		name: params.name,
		email: params.email,
		subject: params.subject,
		message: params.message
	});

	return { thread, message };
}

export interface PostmarkInboundPayload {
	From: string;
	FromName: string;
	FromFull: { Email: string; Name: string };
	To: string;
	Subject: string;
	TextBody: string;
	HtmlBody: string;
	StrippedTextReply: string;
	MessageID: string;
	Date: string;
	Headers: Array<{ Name: string; Value: string }>;
	Attachments: Array<{ Name: string; Content: string; ContentType: string; ContentLength: number }>;
	/** Part after the `+` in the recipient address — carries our signed thread id */
	MailboxHash?: string;
	OriginalRecipient?: string;
	ToFull?: Array<{ Email: string; Name: string; MailboxHash: string }>;
}

/** Pull the sender's real RFC 5322 Message-ID out of the raw headers. Postmark's
 *  own `MessageID` is an internal GUID, not a msg-id, so it can't be threaded on. */
function extractMessageIdHeader(headers: PostmarkInboundPayload['Headers']): string | null {
	const header = headers?.find((h) => h.Name?.toLowerCase() === 'message-id');
	const value = header?.Value?.trim();
	return value && value.includes('@') ? value : null;
}

export async function handlePostmarkInbound(payload: PostmarkInboundPayload) {
	const fromEmail = payload.FromFull?.Email ?? payload.From;
	const fromName = payload.FromName || fromEmail;
	const body = payload.StrippedTextReply || payload.TextBody || '';
	const subject = payload.Subject || null;

	const rawHash = payload.MailboxHash || payload.ToFull?.[0]?.MailboxHash || null;
	const hashedThreadId = parseReplyMailboxHash(rawHash);

	// A reply to a thread we started: route it straight back, whatever the
	// thread's channel. A contact-form thread stays 'web' — that provenance is
	// what the staff UI shows, and re-labelling it 'email' would let unrelated
	// mail from the same address start merging into it.
	if (hashedThreadId) {
		const thread = await findThreadById(hashedThreadId);
		if (thread) {
			if (thread.status === 'resolved') {
				await reopenThread(thread.id);
			}

			const message = await addInboundMessage({
				threadId: thread.id,
				body,
				bodyHtml: payload.HtmlBody || null,
				authorName: fromName,
				channelMessageId: extractMessageIdHeader(payload.Headers) ?? payload.MessageID ?? null,
				channelMetadata: {
					headers: payload.Headers,
					attachmentCount: payload.Attachments?.length ?? 0,
					date: payload.Date,
					postmarkMessageId: payload.MessageID,
					// The reply may have been forwarded — record who actually sent it,
					// but leave thread.contactEmail alone so staff replies keep going
					// to the original contact.
					fromEmail
				}
			});

			return { thread, message };
		}
	}

	// No usable hash: unsolicited mail to the support address. Only accepted
	// when the email channel is switched on.
	if (!(await isChannelEnabled('email'))) {
		return { thread: null, message: null };
	}

	const thread = await findOrCreateThread({
		channel: 'email',
		contactName: fromName,
		contactEmail: fromEmail,
		subject
	});

	const message = await addInboundMessage({
		threadId: thread.id,
		body,
		bodyHtml: payload.HtmlBody || null,
		authorName: fromName,
		channelMessageId: extractMessageIdHeader(payload.Headers) ?? payload.MessageID ?? null,
		channelMetadata: {
			headers: payload.Headers,
			attachmentCount: payload.Attachments?.length ?? 0,
			date: payload.Date,
			postmarkMessageId: payload.MessageID,
			// Present but unusable — surfaced so a routing failure is diagnosable
			// from the message record rather than silently creating a new thread.
			...(rawHash && !hashedThreadId ? { unresolvedMailboxHash: rawHash } : {})
		}
	});

	return { thread, message };
}

export interface TwilioInboundParams {
	From: string;
	To: string;
	Body: string;
	MessageSid: string;
	NumMedia?: string;
}

export async function handleTwilioInbound(params: TwilioInboundParams) {
	const phone = params.From;
	const body = params.Body || '';

	const thread = await findOrCreateThread({
		channel: 'sms',
		contactPhone: phone
	});

	const message = await addInboundMessage({
		threadId: thread.id,
		body,
		channelMessageId: params.MessageSid,
		channelMetadata: {
			to: params.To,
			numMedia: params.NumMedia ?? '0'
		}
	});

	return { thread, message };
}

export interface MetaInboundParams {
	channel: 'instagram' | 'messenger';
	senderId: string;
	senderName?: string;
	messageId: string;
	text: string;
	timestamp: number;
}

export async function handleMetaInbound(params: MetaInboundParams) {
	const thread = await findOrCreateThread({
		channel: params.channel,
		contactExternalId: params.senderId,
		contactName: params.senderName ?? null
	});

	const message = await addInboundMessage({
		threadId: thread.id,
		body: params.text,
		authorName: params.senderName ?? params.senderId,
		channelMessageId: params.messageId,
		channelMetadata: {
			timestamp: params.timestamp
		}
	});

	return { thread, message };
}
