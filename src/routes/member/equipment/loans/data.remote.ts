import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { command, getRequestEvent } from '$app/server';
import { cancelLoan, getLoanById } from '$lib/server/equipment/loan-service';

function requireUser() {
	const { locals } = getRequestEvent();
	if (!locals.user) throw error(401, 'Not authenticated');
	return locals.user;
}

export const cancelMyLoan = command(z.object({ loanId: z.string().uuid() }), async ({ loanId }) => {
	const currentUser = requireUser();
	const loan = await getLoanById(loanId);

	if (!loan) throw error(404, 'Loan not found');
	if (loan.userId !== currentUser.id) throw error(403, 'Not your loan');
	if (loan.status !== 'requested' && loan.status !== 'scheduled') {
		throw error(400, 'Cannot cancel a loan that has been checked out');
	}

	await cancelLoan(loanId);
	return { success: true };
});
