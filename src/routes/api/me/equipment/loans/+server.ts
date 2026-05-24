import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listUserLoans } from '$lib/server/equipment/loan-service';
import { toISO } from '$lib/server/db/schema/columns';
import type { MemberEquipmentLoansResponse } from '$lib/server/db/schema/api';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return error(401, 'Not authenticated');

	const loans = await listUserLoans(locals.user.id);

	const active = loans
		.filter((l) => ['requested', 'scheduled', 'checked_out'].includes(l.status))
		.map(serializeLoan);

	const past = loans
		.filter((l) => ['returned', 'cancelled'].includes(l.status))
		.map(serializeLoan);

	return json({ active, past } satisfies MemberEquipmentLoansResponse);
};

function serializeLoan(l: Awaited<ReturnType<typeof listUserLoans>>[number]) {
	return {
		...l,
		requestedPickupDate: toISO(l.requestedPickupDate),
		estimatedReturnDate: l.estimatedReturnDate ? toISO(l.estimatedReturnDate) : null,
		scheduledPickupDate: l.scheduledPickupDate ? toISO(l.scheduledPickupDate) : null,
		dueDate: l.dueDate ? toISO(l.dueDate) : null,
		checkedOutAt: l.checkedOutAt ? toISO(l.checkedOutAt) : null,
		returnedAt: l.returnedAt ? toISO(l.returnedAt) : null,
		createdAt: toISO(l.createdAt),
		updatedAt: toISO(l.updatedAt)
	};
}
