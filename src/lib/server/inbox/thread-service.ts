import { db } from '$lib/server/db';
import { inboxThread, inboxMessage, inboxNote } from '$lib/server/db/schema/inbox';
import { user } from '$lib/server/db/schema/authentication';
import { eq, and, desc, count, like, or, inArray, sql } from 'drizzle-orm';
import type { InboxChannel, InboxThreadStatus } from '$lib/server/db/schema/inbox';
import type { PaginationInput } from '$lib/server/db/paginate';
import { paginate } from '$lib/server/db/paginate';

const PREVIEW_LENGTH = 200;

export function truncatePreview(text: string): string {
	if (text.length <= PREVIEW_LENGTH) return text;
	return text.slice(0, PREVIEW_LENGTH) + '…';
}

export interface FindOrCreateThreadParams {
	channel: InboxChannel;
	contactName?: string | null;
	contactEmail?: string | null;
	contactPhone?: string | null;
	contactExternalId?: string | null;
	subject?: string | null;
}

export async function findOrCreateThread(params: FindOrCreateThreadParams) {
	const { channel, contactName, contactEmail, contactPhone, contactExternalId, subject } = params;

	let existing: typeof inboxThread.$inferSelect | undefined;

	if (channel === 'email' && contactEmail) {
		[existing] = await db
			.select()
			.from(inboxThread)
			.where(
				and(
					eq(inboxThread.channel, 'email'),
					eq(inboxThread.contactEmail, contactEmail),
					inArray(inboxThread.status, ['open', 'snoozed'])
				)
			)
			.orderBy(desc(inboxThread.lastMessageAt))
			.limit(1);
	} else if (channel === 'sms' && contactPhone) {
		[existing] = await db
			.select()
			.from(inboxThread)
			.where(
				and(
					eq(inboxThread.channel, 'sms'),
					eq(inboxThread.contactPhone, contactPhone),
					inArray(inboxThread.status, ['open', 'snoozed'])
				)
			)
			.orderBy(desc(inboxThread.lastMessageAt))
			.limit(1);
	} else if ((channel === 'instagram' || channel === 'messenger') && contactExternalId) {
		[existing] = await db
			.select()
			.from(inboxThread)
			.where(
				and(
					eq(inboxThread.channel, channel),
					eq(inboxThread.contactExternalId, contactExternalId),
					inArray(inboxThread.status, ['open', 'snoozed'])
				)
			)
			.orderBy(desc(inboxThread.lastMessageAt))
			.limit(1);
	}
	// channel === 'web' always creates a new thread

	if (existing) return existing;

	const [thread] = await db
		.insert(inboxThread)
		.values({
			channel,
			contactName: contactName ?? null,
			contactEmail: contactEmail ?? null,
			contactPhone: contactPhone ?? null,
			contactExternalId: contactExternalId ?? null,
			subject: subject ?? null
		})
		.returning();

	return thread;
}

export interface ListThreadsFilters {
	status?: InboxThreadStatus;
	channel?: InboxChannel;
	assignedToUserId?: string | null;
	search?: string;
}

export async function listThreads(filters: ListThreadsFilters, pagination: PaginationInput) {
	const conditions = [];

	if (filters.status) conditions.push(eq(inboxThread.status, filters.status));
	if (filters.channel) conditions.push(eq(inboxThread.channel, filters.channel));
	if (filters.assignedToUserId !== undefined) {
		if (filters.assignedToUserId === null) {
			conditions.push(sql`${inboxThread.assignedToUserId} IS NULL`);
		} else {
			conditions.push(eq(inboxThread.assignedToUserId, filters.assignedToUserId));
		}
	}
	if (filters.search) {
		const pattern = `%${filters.search}%`;
		conditions.push(
			or(
				like(inboxThread.contactName, pattern),
				like(inboxThread.contactEmail, pattern),
				like(inboxThread.subject, pattern),
				like(inboxThread.preview, pattern)
			)
		);
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const dataQuery = db
		.select({
			id: inboxThread.id,
			channel: inboxThread.channel,
			status: inboxThread.status,
			subject: inboxThread.subject,
			preview: inboxThread.preview,
			contactName: inboxThread.contactName,
			contactEmail: inboxThread.contactEmail,
			contactPhone: inboxThread.contactPhone,
			assignedToUserId: inboxThread.assignedToUserId,
			assignedToName: user.name,
			messageCount: inboxThread.messageCount,
			lastMessageAt: inboxThread.lastMessageAt,
			createdAt: inboxThread.createdAt
		})
		.from(inboxThread)
		.leftJoin(user, eq(inboxThread.assignedToUserId, user.id))
		.where(where)
		.orderBy(desc(inboxThread.lastMessageAt))
		.$dynamic();

	const countQuery = db.select({ count: count() }).from(inboxThread).where(where);

	return paginate(dataQuery, countQuery, pagination);
}

export async function getThread(id: string) {
	const [thread] = await db
		.select({
			id: inboxThread.id,
			channel: inboxThread.channel,
			status: inboxThread.status,
			subject: inboxThread.subject,
			contactName: inboxThread.contactName,
			contactEmail: inboxThread.contactEmail,
			contactPhone: inboxThread.contactPhone,
			contactExternalId: inboxThread.contactExternalId,
			assignedToUserId: inboxThread.assignedToUserId,
			assignedToName: user.name,
			snoozedUntil: inboxThread.snoozedUntil,
			messageCount: inboxThread.messageCount,
			lastMessageAt: inboxThread.lastMessageAt,
			createdAt: inboxThread.createdAt
		})
		.from(inboxThread)
		.leftJoin(user, eq(inboxThread.assignedToUserId, user.id))
		.where(eq(inboxThread.id, id))
		.limit(1);

	if (!thread) return null;

	const messages = await db
		.select()
		.from(inboxMessage)
		.where(eq(inboxMessage.threadId, id))
		.orderBy(inboxMessage.createdAt);

	const notes = await db
		.select({
			id: inboxNote.id,
			threadId: inboxNote.threadId,
			authorUserId: inboxNote.authorUserId,
			authorName: user.name,
			body: inboxNote.body,
			createdAt: inboxNote.createdAt
		})
		.from(inboxNote)
		.leftJoin(user, eq(inboxNote.authorUserId, user.id))
		.where(eq(inboxNote.threadId, id))
		.orderBy(inboxNote.createdAt);

	return { ...thread, messages, notes };
}

export async function assignThread(threadId: string, userId: string | null) {
	await db
		.update(inboxThread)
		.set({ assignedToUserId: userId, updatedAt: new Date() })
		.where(eq(inboxThread.id, threadId));
}

export async function updateStatus(
	threadId: string,
	status: InboxThreadStatus,
	snoozedUntil?: Date
) {
	await db
		.update(inboxThread)
		.set({
			status,
			snoozedUntil: status === 'snoozed' ? (snoozedUntil ?? null) : null,
			updatedAt: new Date()
		})
		.where(eq(inboxThread.id, threadId));
}

export async function getUnresolvedCount(): Promise<number> {
	const [row] = await db
		.select({ count: count() })
		.from(inboxThread)
		.where(eq(inboxThread.status, 'open'));
	return row?.count ?? 0;
}
