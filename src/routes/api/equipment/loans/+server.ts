import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { requestLoan } from '$lib/server/equipment/loan-service';

export const POST: RequestHandler = async ({ request, locals }) => {
	await requireStaffRole(locals.user?.id);
	const { userId, equipmentId, quantity, requestedPickupDate, estimatedReturnDate, memberNotes } =
		(await request.json()) as {
			userId: string;
			equipmentId?: string;
			quantity?: number;
			requestedPickupDate: string;
			estimatedReturnDate: string;
			memberNotes?: string;
		};
	if (!userId || !requestedPickupDate || !estimatedReturnDate) {
		return json({ error: 'userId, requestedPickupDate, and estimatedReturnDate required' }, { status: 400 });
	}
	await requestLoan(userId, {
		equipmentId,
		quantity: quantity ?? 1,
		requestedPickupDate: new Date(requestedPickupDate),
		estimatedReturnDate: new Date(estimatedReturnDate),
		memberNotes
	});
	return json({ success: true });
};
