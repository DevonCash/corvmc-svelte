import { db } from '$lib/server/db';
import { ticket } from '$lib/server/db/schema/ticket';
import { event } from '$lib/server/db/schema/event';
import { user } from '$lib/server/db/schema/auth';
import { eq, and, inArray, sql, asc, desc } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TicketStatus = 'pending' | 'valid' | 'checked_in' | 'cancelled';

export interface CreateTicketsOptions {
	eventId: string;
	purchaseId: string;
	quantity: number;
	userId?: string | null;
	attendeeName: string;
	attendeeEmail: string;
	status?: TicketStatus;
}

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------
// 8-character alphanumeric codes excluding ambiguous characters (0, O, I, L, 1)

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export function generateCodeString(): string {
	const chars: string[] = [];
	for (let i = 0; i < CODE_LENGTH; i++) {
		chars.push(CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]);
	}
	return chars.join('');
}

/** Generate a unique code that doesn't exist in the database. */
export async function generateCode(): Promise<string> {
	for (let attempt = 0; attempt < 10; attempt++) {
		const code = generateCodeString();
		const [existing] = await db
			.select({ id: ticket.id })
			.from(ticket)
			.where(eq(ticket.code, code))
			.limit(1);

		if (!existing) return code;
	}
	throw new Error('Failed to generate unique ticket code after 10 attempts');
}

// ---------------------------------------------------------------------------
// Create tickets
// ---------------------------------------------------------------------------

export async function createTickets(options: CreateTicketsOptions) {
	const { eventId, purchaseId, quantity, userId, attendeeName, attendeeEmail, status = 'pending' } = options;

	const codes: string[] = [];
	for (let i = 0; i < quantity; i++) {
		codes.push(await generateCode());
	}

	const rows = codes.map((code) => ({
		eventId,
		purchaseId,
		userId: userId ?? null,
		attendeeName,
		attendeeEmail,
		code,
		status
	}));

	const created = await db.insert(ticket).values(rows).returning();
	return created;
}

// ---------------------------------------------------------------------------
// Fulfill purchase (webhook callback)
// ---------------------------------------------------------------------------

export async function fulfillPurchase(purchaseId: string) {
	const rows = await db
		.update(ticket)
		.set({ status: 'valid', updatedAt: new Date() })
		.where(and(eq(ticket.purchaseId, purchaseId), eq(ticket.status, 'pending')))
		.returning();

	return rows;
}

// ---------------------------------------------------------------------------
// Cancel purchase
// ---------------------------------------------------------------------------

export async function cancelPurchase(purchaseId: string): Promise<number> {
	const rows = await db
		.update(ticket)
		.set({ status: 'cancelled', updatedAt: new Date() })
		.where(
			and(
				eq(ticket.purchaseId, purchaseId),
				inArray(ticket.status, ['pending', 'valid'])
			)
		)
		.returning({ id: ticket.id });

	return rows.length;
}

// ---------------------------------------------------------------------------
// Check in
// ---------------------------------------------------------------------------

export async function checkIn(ticketId: string, staffUserId: string): Promise<void> {
	const [row] = await db
		.select({ status: ticket.status })
		.from(ticket)
		.where(eq(ticket.id, ticketId))
		.limit(1);

	if (!row) throw new Error('Ticket not found');
	if (row.status !== 'valid') throw new Error(`Cannot check in ticket with status "${row.status}"`);

	await db
		.update(ticket)
		.set({
			status: 'checked_in',
			checkedInAt: new Date(),
			checkedInByUserId: staffUserId,
			updatedAt: new Date()
		})
		.where(eq(ticket.id, ticketId));
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getTicketsByPurchase(purchaseId: string) {
	return db
		.select()
		.from(ticket)
		.where(eq(ticket.purchaseId, purchaseId))
		.orderBy(asc(ticket.code));
}

export async function getEventTickets(eventId: string, statusFilter?: TicketStatus[]) {
	const conditions = [eq(ticket.eventId, eventId)];
	if (statusFilter && statusFilter.length > 0) {
		conditions.push(inArray(ticket.status, statusFilter));
	}

	return db
		.select({
			id: ticket.id,
			eventId: ticket.eventId,
			purchaseId: ticket.purchaseId,
			userId: ticket.userId,
			attendeeName: ticket.attendeeName,
			attendeeEmail: ticket.attendeeEmail,
			code: ticket.code,
			status: ticket.status,
			checkedInAt: ticket.checkedInAt,
			checkedInByUserId: ticket.checkedInByUserId,
			checkedInByName: user.name,
			createdAt: ticket.createdAt
		})
		.from(ticket)
		.leftJoin(user, eq(user.id, ticket.checkedInByUserId))
		.where(and(...conditions))
		.orderBy(asc(ticket.attendeeName), asc(ticket.code));
}

export async function getTicketsSold(eventId: string): Promise<number> {
	const [result] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(ticket)
		.where(
			and(
				eq(ticket.eventId, eventId),
				inArray(ticket.status, ['valid', 'checked_in'])
			)
		);

	return result?.count ?? 0;
}

export async function getTicketsRemaining(eventId: string): Promise<number | null> {
	const [ev] = await db
		.select({ ticketQuantity: event.ticketQuantity })
		.from(event)
		.where(eq(event.id, eventId))
		.limit(1);

	if (!ev || ev.ticketQuantity == null) return null;

	const sold = await getTicketsSold(eventId);
	return Math.max(0, ev.ticketQuantity - sold);
}

export async function getUserTickets(userId: string) {
	return db
		.select({
			id: ticket.id,
			eventId: ticket.eventId,
			purchaseId: ticket.purchaseId,
			code: ticket.code,
			status: ticket.status,
			attendeeName: ticket.attendeeName,
			checkedInAt: ticket.checkedInAt,
			createdAt: ticket.createdAt,
			eventTitle: event.title,
			eventStartsAt: event.startsAt,
			eventEndsAt: event.endsAt
		})
		.from(ticket)
		.innerJoin(event, eq(event.id, ticket.eventId))
		.where(eq(ticket.userId, userId))
		.orderBy(desc(event.startsAt), asc(ticket.code));
}
