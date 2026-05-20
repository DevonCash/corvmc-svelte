import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { refund } from '$lib/server/finance/payment-service';
import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ params, locals }) => {
	await requireStaffRole(locals.user?.id);

	const [row] = await db
		.select({
			createdByUserId: reservation.createdByUserId,
			stripePaymentRecordId: reservation.stripePaymentRecordId
		})
		.from(reservation)
		.where(eq(reservation.id, params.id))
		.limit(1);
	if (!row) throw error(404, 'Reservation not found');
	if (!row.stripePaymentRecordId) throw error(400, 'No payment to refund');

	await refund({
		userId: row.createdByUserId,
		stripePaymentRecordId: row.stripePaymentRecordId
	});
	return json({ success: true });
};
