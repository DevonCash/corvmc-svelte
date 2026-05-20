import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isStaff } from '$lib/server/authorization';
import { cancelLoan, getLoanById } from '$lib/server/equipment/loan-service';

export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Not authenticated');
	const loan = await getLoanById(params.id);
	if (!loan) throw error(404, 'Loan not found');

	const staff = await isStaff(locals.user.id);
	if (!staff) {
		if (loan.userId !== locals.user.id) throw error(403, 'Not authorized');
		if (loan.status !== 'requested' && loan.status !== 'scheduled') {
			throw error(400, 'Cannot cancel a loan that has been checked out');
		}
	}

	await cancelLoan(params.id);
	return json({ success: true });
};
