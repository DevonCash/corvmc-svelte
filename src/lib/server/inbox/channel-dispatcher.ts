import { env } from '$env/dynamic/private';
import { sendInboxReply } from '$lib/server/notification/email/postmark-client';
import { templates } from '$lib/server/notification/email';
import { sendSms } from './twilio-client';
import { isChannelEnabled } from './channel-config-service';
import type { InboxChannel } from '$lib/server/db/schema/inbox';

export interface DispatchReplyParams {
	channel: InboxChannel;
	threadId: string;
	body: string;
	staffName: string;
	contactName: string | null;
	contactEmail: string | null;
	contactPhone: string | null;
	contactExternalId: string | null;
	subject: string | null;
	/** Last inbound channelMessageId for email threading */
	lastInboundMessageId: string | null;
	/** Accumulated References chain */
	references: string | null;
}

export async function dispatchReply(params: DispatchReplyParams): Promise<string | null> {
	const enabled = await isChannelEnabled(params.channel);
	if (!enabled) {
		throw new Error(`Channel "${params.channel}" is not enabled. Enable it in Settings → Inbox Channels.`);
	}

	switch (params.channel) {
		case 'email':
			return dispatchEmailReply(params);
		case 'sms':
			return dispatchSmsReply(params);
		case 'instagram':
		case 'messenger':
			return dispatchMetaReply(params);
		case 'web':
			return null;
	}
}

async function dispatchSmsReply(params: DispatchReplyParams): Promise<string> {
	if (!params.contactPhone) {
		throw new Error('Cannot send SMS reply: no contact phone on thread');
	}

	const sid = await sendSms(params.contactPhone, params.body);
	return sid;
}

async function dispatchEmailReply(params: DispatchReplyParams): Promise<string> {
	if (!params.contactEmail) {
		throw new Error('Cannot send email reply: no contact email on thread');
	}

	const siteUrl = env.PUBLIC_SITE_URL ?? 'https://corvmc.org';

	const htmlBody = templates.inboxReply({
		contactName: params.contactName ?? 'there',
		staffName: params.staffName,
		body: params.body,
		siteUrl
	});

	const subject = params.subject
		? (params.subject.startsWith('Re:') ? params.subject : `Re: ${params.subject}`)
		: 'Re: Your message to CorvMC';

	const messageId = await sendInboxReply({
		to: params.contactEmail,
		subject,
		htmlBody,
		textBody: params.body,
		inReplyTo: params.lastInboundMessageId,
		references: params.references,
		metadata: { threadId: params.threadId }
	});

	return messageId;
}

async function dispatchMetaReply(params: DispatchReplyParams): Promise<string> {
	if (!params.contactExternalId) {
		throw new Error('Cannot send Meta reply: no contact external ID on thread');
	}

	const pageToken = env.META_PAGE_ACCESS_TOKEN;
	if (!pageToken) {
		throw new Error('META_PAGE_ACCESS_TOKEN is not configured');
	}

	const response = await fetch('https://graph.facebook.com/v21.0/me/messages', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${pageToken}`
		},
		body: JSON.stringify({
			recipient: { id: params.contactExternalId },
			message: { text: params.body },
			messaging_type: 'RESPONSE'
		})
	});

	if (!response.ok) {
		const err = await response.text();
		throw new Error(`Meta API error (${response.status}): ${err}`);
	}

	const result = (await response.json()) as { message_id?: string };
	return result.message_id ?? '';
}
