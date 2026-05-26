import { db } from '$lib/server/db';
import { inboxThread, inboxMessage, inboxNote } from '$lib/server/db/schema/inbox';
import { eq, sql } from 'drizzle-orm';
import { domainEvents } from '$lib/server/events/event-bus';
import { truncatePreview } from './thread-service';

export interface AddInboundMessageParams {
	threadId: string;
	body: string;
	bodyHtml?: string | null;
	authorName?: string | null;
	channelMessageId?: string | null;
	channelMetadata?: unknown;
}

export async function addInboundMessage(params: AddInboundMessageParams) {
	const [message] = await db
		.insert(inboxMessage)
		.values({
			threadId: params.threadId,
			direction: 'inbound',
			body: params.body,
			bodyHtml: params.bodyHtml ?? null,
			authorName: params.authorName ?? null,
			channelMessageId: params.channelMessageId ?? null,
			channelMetadata: params.channelMetadata ?? null
		})
		.returning();

	await db
		.update(inboxThread)
		.set({
			preview: truncatePreview(params.body),
			messageCount: sql`${inboxThread.messageCount} + 1`,
			lastMessageAt: new Date(),
			updatedAt: new Date()
		})
		.where(eq(inboxThread.id, params.threadId));

	const [thread] = await db
		.select({ channel: inboxThread.channel, contactName: inboxThread.contactName })
		.from(inboxThread)
		.where(eq(inboxThread.id, params.threadId))
		.limit(1);

	domainEvents.emit('inbox.message_received', {
		threadId: params.threadId,
		messageId: message.id,
		channel: thread.channel,
		contactName: thread.contactName,
		preview: truncatePreview(params.body)
	});

	return message;
}

export interface AddOutboundMessageParams {
	threadId: string;
	body: string;
	authorUserId: string;
	authorName: string;
}

export async function addOutboundMessage(params: AddOutboundMessageParams) {
	const [message] = await db
		.insert(inboxMessage)
		.values({
			threadId: params.threadId,
			direction: 'outbound',
			body: params.body,
			authorName: params.authorName,
			authorUserId: params.authorUserId
		})
		.returning();

	await db
		.update(inboxThread)
		.set({
			preview: truncatePreview(params.body),
			messageCount: sql`${inboxThread.messageCount} + 1`,
			lastMessageAt: new Date(),
			updatedAt: new Date()
		})
		.where(eq(inboxThread.id, params.threadId));

	domainEvents.emit('inbox.message_sent', {
		threadId: params.threadId,
		messageId: message.id,
		channel: 'web',
		sentByUserId: params.authorUserId
	});

	return message;
}

export async function addNote(params: { threadId: string; authorUserId: string; body: string }) {
	const [note] = await db
		.insert(inboxNote)
		.values({
			threadId: params.threadId,
			authorUserId: params.authorUserId,
			body: params.body
		})
		.returning();

	return note;
}
