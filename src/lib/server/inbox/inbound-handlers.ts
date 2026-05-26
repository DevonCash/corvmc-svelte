import { findOrCreateThread } from './thread-service';
import { addInboundMessage } from './message-service';

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
}

export async function handlePostmarkInbound(payload: PostmarkInboundPayload) {
	const fromEmail = payload.FromFull?.Email ?? payload.From;
	const fromName = payload.FromName || fromEmail;
	const body = payload.StrippedTextReply || payload.TextBody || '';
	const subject = payload.Subject || null;

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
		channelMessageId: payload.MessageID || null,
		channelMetadata: {
			headers: payload.Headers,
			attachmentCount: payload.Attachments?.length ?? 0,
			date: payload.Date
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
