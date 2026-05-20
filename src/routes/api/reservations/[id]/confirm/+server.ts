import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { requireStaffOrOwner } from '$lib/server/authorization';
import { confirm } from '$lib/server/reservation/reservation-service';
import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ params, locals }) => {
	const [row] = await db
		.select({ createdByUserId: reservation.createdByUserId })
		.from(reservation)
		.where(eq(reservation.id, params.id))
		.limit(1);
	if (!row) throw error(404, 'Reservation not found');

	await requireStaffOrOwner(locals.user?.id, row.createdByUserId);
	await confirm(params.id);
	return json({ success: true });
};
