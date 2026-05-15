import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { form, getRequestEvent } from '$app/server';
import { requestLoan } from '$lib/server/equipment/loan-service';

function requireUser() {
	const { locals } = getRequestEvent();
	if (!locals.user) throw error(401, 'Not authenticated');
	return locals.user;
}

const submitRequestSchema = z.object({
	equipmentId: z.string().uuid().optional(),
	quantity: z.string().default('1'),
	requestedPickupDate: z.string().min(1),
	memberNotes: z.string().max(1000).optional()
});

export const submitRequest = form(submitRequestSchema, async (raw) => {
	const data = raw as z.infer<typeof submitRequestSchema>;
	const currentUser = requireUser();

	const loan = await requestLoan(currentUser.id, {
		equipmentId: data.equipmentId,
		quantity: parseInt(data.quantity, 10) || 1,
		requestedPickupDate: new Date(data.requestedPickupDate),
		memberNotes: data.memberNotes
	});

	return { success: true, loanId: loan.id };
});
