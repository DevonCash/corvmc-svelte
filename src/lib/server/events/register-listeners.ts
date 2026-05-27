import { domainEvents } from './event-bus';

// ---------------------------------------------------------------------------
// Listener registration
// ---------------------------------------------------------------------------
// Called once at server startup (from hooks.server.ts). Registers all
// domain event listeners — checkout fulfillment, notification dispatch, etc.
//
// Each listener module exports a setup function that subscribes to the
// events it cares about. Import order doesn't matter since emittery
// supports multiple listeners per event.
// ---------------------------------------------------------------------------

let registered = false;

export function registerListeners(): void {
	if (registered) return;
	registered = true;

	// --- Checkout fulfillment (migrated from callback pattern) ---
	registerCheckoutListeners();

	// --- Notification dispatch ---
	registerNotificationListeners();

	// --- Waitlist promotion on cancellation ---
	registerWaitlistListeners();
}

// ---------------------------------------------------------------------------
// Checkout fulfillment listeners
// ---------------------------------------------------------------------------
// These replace the old onCheckoutComplete() callback registry.
// Each module checks session metadata to decide whether to act.
// ---------------------------------------------------------------------------

async function registerCheckoutListeners(): Promise<void> {
	const { handleReservationCheckout } = await import(
		'$lib/server/reservation/checkout-listener'
	);
	const { handleTicketCheckout } = await import('$lib/server/ticket/checkout-listener');
	const { handleBandPremiumCheckout } = await import(
		'$lib/server/band/band-checkout-listener'
	);

	domainEvents.on('checkout.completed', async (event) => {
		await handleReservationCheckout(event.stripeSession);
	});

	domainEvents.on('checkout.completed', async (event) => {
		await handleTicketCheckout(event.stripeSession);
	});

	domainEvents.on('checkout.completed', async (event) => {
		await handleBandPremiumCheckout(event.stripeSession);
	});
}

// ---------------------------------------------------------------------------
// Notification listeners
// ---------------------------------------------------------------------------
// Imported from the notification module. Wires domain events to the
// notification dispatcher which handles preference checks and channel routing.
// ---------------------------------------------------------------------------

async function registerNotificationListeners(): Promise<void> {
	const { registerAllNotificationListeners } = await import(
		'$lib/server/notification/notification-listeners'
	);
	registerAllNotificationListeners();
}

// ---------------------------------------------------------------------------
// Waitlist listeners
// ---------------------------------------------------------------------------
// When a reservation is cancelled, check if any waitlisted reservations
// can be promoted to fill the freed slot.
// ---------------------------------------------------------------------------

async function registerWaitlistListeners(): Promise<void> {
	const { promoteNextWaitlisted } = await import(
		'$lib/server/reservation/waitlist-service'
	);

	domainEvents.on('reservation.cancelled', async (event) => {
		// Parse the original reservation's time range to find waitlisted candidates
		// We need the raw Date objects — reconstruct from the formatted strings
		// by looking up the cancelled reservation directly
		const { db } = await import('$lib/server/db');
		const { reservation } = await import('$lib/server/db/schema/reservation');
		const { eq } = await import('drizzle-orm');

		const [row] = await db
			.select({ startsAt: reservation.startsAt, endsAt: reservation.endsAt })
			.from(reservation)
			.where(eq(reservation.id, event.reservationId))
			.limit(1);

		if (row) {
			await promoteNextWaitlisted(row.startsAt, row.endsAt);
		}
	});
}
