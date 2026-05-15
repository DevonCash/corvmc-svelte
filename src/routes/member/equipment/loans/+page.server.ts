import { redirect } from '@sveltejs/kit';
import { listUserLoans } from '$lib/server/equipment/loan-service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) return redirect(302, '/demo/better-auth/login');

	const loans = await listUserLoans(locals.user.id);

	const active = loans
		.filter((l) => ['requested', 'scheduled', 'checked_out'].includes(l.status))
		.map(serializeLoan);

	const past = loans
		.filter((l) => ['returned', 'cancelled'].includes(l.status))
		.map(serializeLoan);

	return { active, past };
};

function serializeLoan(l: Awaited<ReturnType<typeof listUserLoans>>[number]) {
	return {
		...l,
		requestedPickupDate: l.requestedPickupDate.toISOString(),
		scheduledPickupDate: l.scheduledPickupDate?.toISOString() ?? null,
		dueDate: l.dueDate?.toISOString() ?? null,
		checkedOutAt: l.checkedOutAt?.toISOString() ?? null,
		returnedAt: l.returnedAt?.toISOString() ?? null,
		createdAt: l.createdAt.toISOString(),
		updatedAt: l.updatedAt.toISOString()
	};
}
