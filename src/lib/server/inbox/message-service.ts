import { db } from '$lib/server/db';
import { inboxThread, inboxMessage, inboxNote } from '$lib/server/db/schema/inbox';
import { eq, sql, desc, and } from 'drizzle-orm';
import { domainEvents } from '$lib/server/events/event-bus';
import { truncatePreview } from './thread-service';
import { dispatchReply } from './channel-dispatcher';

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
	const [thread] = await db
		.select()
		.from(inboxThread)
		.where(eq(inboxThread.id, params.threadId))
		.limit(1);

	if (!thread) throw new Error(`Thread ${params.threadId} not found`);

	// Find last inbound message ID for email threading
	const [lastInbound] = await db
		.select({ channelMessageId: inboxMessage.channelMessageId })
		.from(inboxMessage)
		.where(and(eq(inboxMessage.threadId, params.threadId), eq(inboxMessage.direction, 'inbound')))
		.orderBy(desc(inboxMessage.createdAt))
		.limit(1);

	// Build References chain from all inbound message IDs
	const inboundIds = await db
		.select({ channelMessageId: inboxMessage.channelMessageId })
		.from(inboxMessage)
		.where(and(eq(inboxMessage.threadId, params.threadId), eq(inboxMessage.direction, 'inbound')))
		.orderBy(inboxMessage.createdAt);

	const references = inboundIds
		.map((m) => m.channelMessageId)
		.filter(Boolean)
		.join(' ') || null;

	let channelMessageId: string | null = null;

	try {
		channelMessageId = (await dispatchReply({
			channel: thread.channel,
			threadId: thread.id,
			body: params.body,
			staffName: params.authorName,
			contactName: thread.contactName,
			contactEmail: thread.contactEmail,
			contactPhone: thread.contactPhone,
			contactExternalId: thread.contactExternalId,
			subject: thread.subject,
			lastInboundMessageId: lastInbound?.channelMessageId ?? null,
			references
		})) ?? null;
	} catch (err) {
		console.error('[inbox] Failed to dispatch reply:', err);
		throw err;
	}

	const [message] = await db
		.insert(inboxMessage)
		.values({
			threadId: params.threadId,
			direction: 'outbound',
			body: params.body,
			authorName: params.authorName,
			authorUserId: params.authorUserId,
			channelMessageId
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
		channel: thread.channel,
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
