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

	domainEvents.on('checkout.completed', async (event) => {
		await handleReservationCheckout(event.stripeSession);
	});

	domainEvents.on('checkout.completed', async (event) => {
		await handleTicketCheckout(event.stripeSession);
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
