import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, command, getRequestEvent } from '$app/server';
import { requireStaff } from '$lib/server/authorization';
import {
	getLoanById,
	scheduleLoan,
	checkoutLoan,
	returnLoan,
	cancelLoan
} from '$lib/server/equipment/loan-service';
import { listEquipment } from '$lib/server/equipment/equipment-service';
import { scheduleLoanSchema, checkoutLoanSchema } from '$lib/server/equipment/types';

export const getLoan = query(z.string(), async (id) => {
	await requireStaff();
	const loan = await getLoanById(id);
	if (!loan) error(404, 'Loan not found');
	return loan;
});

export const getAvailableEquipment = query(z.void(), async () => {
	await requireStaff();
	return listEquipment({ status: 'available' });
});

export const schedule = command(scheduleLoanSchema, async (data) => {
	await requireStaff();
	const { params } = getRequestEvent();
	await scheduleLoan(params.id!, {
		equipmentId: data.equipmentId,
		scheduledPickupDate: new Date(data.scheduledPickupDate)
	});
	void getLoan(params.id!).refresh();
	return { success: true };
});

export const checkout = command(checkoutLoanSchema, async (data) => {
	await requireStaff();
	const { params } = getRequestEvent();
	await checkoutLoan(params.id!, { dueDate: new Date(data.dueDate) });
	void getLoan(params.id!).refresh();
	return { success: true };
});

export const markReturned = command(
	z.object({ staffNotes: z.string().max(1000).optional() }),
	async (data) => {
		await requireStaff();
		const { params } = getRequestEvent();
		await returnLoan(params.id!, data.staffNotes);
		void getLoan(params.id!).refresh();
		return { success: true };
	}
);

export const cancel = command(z.object({}), async () => {
	await requireStaff();
	const { params } = getRequestEvent();
	await cancelLoan(params.id!);
	void getLoan(params.id!).refresh();
	return { success: true };
});
