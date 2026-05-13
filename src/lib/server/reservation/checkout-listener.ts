import type Stripe from 'stripe';
import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { eq } from 'drizzle-orm';
import { onCheckoutComplete } from '$lib/server/finance/webhook-handlers';

// ---------------------------------------------------------------------------
// Reservation checkout listener
// ---------------------------------------------------------------------------
// Registered at module load time. When a Stripe checkout session completes
// with a `reservation_id` in metadata, transitions the reservation from
// scheduled → confirmed.
// ---------------------------------------------------------------------------

export function registerReservationCheckoutListener(): void {
	onCheckoutComplete(handleReservationCheckout);
}

async function handleReservationCheckout(session: Stripe.Checkout.Session): Promise<void> {
	const reservationId = session.metadata?.reservation_id;
	if (!reservationId) return;

	// Only transition if still scheduled (idempotency — payment webhook can fire multiple times)
	const [row] = await db
		.select({ status: reservation.status })
		.from(reservation)
		.where(eq(reservation.id, reservationId))
		.limit(1);

	if (!row || row.status !== 'scheduled') return;

	// The payment record ID comes from the session's payment_intent or the session ID itself
	const paymentRecordId = session.payment_intent
		? (typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id)
		: session.id;

	await db
		.update(reservation)
		.set({
			status: 'confirmed',
			stripePaymentRecordId: paymentRecordId,
			updatedAt: new Date()
		})
		.where(eq(reservation.id, reservationId));
}
