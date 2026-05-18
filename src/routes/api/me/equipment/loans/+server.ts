import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listUserLoans } from '$lib/server/equipment/loan-service';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return error(401, 'Not authenticated');

	const loans = await listUserLoans(locals.user.id);

	const active = loans
		.filter((l) => ['requested', 'scheduled', 'checked_out'].includes(l.status))
		.map(serializeLoan);

	const past = loans
		.filter((l) => ['returned', 'cancelled'].includes(l.status))
		.map(serializeLoan);

	return json({ active, past });
};

function serializeLoan(l: Awaited<ReturnType<typeof listUserLoans>>[number]) {
	return {
		...l,
		requestedPickupDate: l.requestedPickupDate.toISOString(),
		estimatedReturnDate: l.estimatedReturnDate?.toISOString() ?? null,
		scheduledPickupDate: l.scheduledPickupDate?.toISOString() ?? null,
		dueDate: l.dueDate?.toISOString() ?? null,
		checkedOutAt: l.checkedOutAt?.toISOString() ?? null,
		returnedAt: l.returnedAt?.toISOString() ?? null,
		createdAt: l.createdAt.toISOString(),
		updatedAt: l.updatedAt.toISOString()
	};
}
