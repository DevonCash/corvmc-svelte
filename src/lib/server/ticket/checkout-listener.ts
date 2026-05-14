import type Stripe from 'stripe';
import { fulfillPurchase } from './ticket-service';
import { domainEvents } from '$lib/server/events/event-bus';
import { db } from '$lib/server/db';
import { event } from '$lib/server/db/schema/event';
import { eq } from 'drizzle-orm';
import { DateTime } from 'luxon';

// ---------------------------------------------------------------------------
// Ticket checkout listener
// ---------------------------------------------------------------------------
// Called by the domain event bus when a checkout completes. Inspects session
// metadata for type=ticket and a purchase_id, then transitions all pending
// tickets for that purchase to valid and emits a ticket.purchased event.
// ---------------------------------------------------------------------------

export async function handleTicketCheckout(session: Stripe.Checkout.Session): Promise<void> {
	if (session.metadata?.type !== 'ticket') return;

	const purchaseId = session.metadata?.purchase_id;
	if (!purchaseId) return;

	// fulfillPurchase returns the updated rows directly, avoiding a
	// separate query that could race with concurrent writes.
	const tickets = await fulfillPurchase(purchaseId);
	if (tickets.length === 0) return;

	// Emit ticket.purchased for notification dispatch
	try {
		const eventId = tickets[0].eventId;
		const [eventRow] = await db.select().from(event).where(eq(event.id, eventId)).limit(1);
		if (!eventRow) return;

		const eventDt = DateTime.fromJSDate(eventRow.startsAt);

		await domainEvents.emit('ticket.purchased', {
			purchaseId,
			attendeeName: tickets[0].attendeeName,
			attendeeEmail: tickets[0].attendeeEmail,
			eventTitle: eventRow.title,
			eventDate: eventDt.toLocaleString(DateTime.DATE_FULL),
			eventTime: eventDt.toLocaleString(DateTime.TIME_SIMPLE),
			ticketCodes: tickets.map((t) => t.code),
			quantity: tickets.length
		});
	} catch (err) {
		console.error('[events] ticket.purchased emission failed:', err);
	}
}
