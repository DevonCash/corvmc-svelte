import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { recordCashAndComplete } from '$lib/server/reservation/reservation-service';
import { recordCashPayment } from '$lib/server/finance/payment-service';
import { getProductConfig } from '$lib/server/finance/product-config-service';
import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { user } from '$lib/server/db/schema/auth';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ params, locals }) => {
	await requireStaffRole(locals.user?.id);

	const [row] = await db
		.select({
			createdByUserId: reservation.createdByUserId,
			startsAt: reservation.startsAt,
			endsAt: reservation.endsAt
		})
		.from(reservation)
		.where(eq(reservation.id, params.id))
		.limit(1);
	if (!row) throw error(404, 'Reservation not found');

	const durationMs = row.endsAt.getTime() - row.startsAt.getTime();
	const durationHours = durationMs / (1000 * 60 * 60);
	const rehearsal = await getProductConfig('rehearsal');
	const amountCents = Math.round(durationHours * rehearsal.unitAmountCents);

	const [member] = await db
		.select({ stripeId: user.stripeId })
		.from(user)
		.where(eq(user.id, row.createdByUserId))
		.limit(1);
	if (!member?.stripeId) throw error(400, 'Member has no Stripe customer ID');

	const { paymentRecordId } = await recordCashPayment({
		userId: row.createdByUserId,
		stripeCustomerId: member.stripeId,
		amountCents,
		metadata: { reservation_id: params.id }
	});

	await recordCashAndComplete(params.id, paymentRecordId);
	return json({ success: true });
};
