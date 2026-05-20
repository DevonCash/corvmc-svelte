import { z } from 'zod';
import { error, invalid } from '@sveltejs/kit';
import { query, form, getRequestEvent } from '$app/server';
import { requireStaff } from '$lib/server/authorization';
import {
	getLoanById,
	scheduleLoan,
	checkoutLoan
} from '$lib/server/equipment/loan-service';
import { listEquipment } from '$lib/server/equipment/equipment-service';
import { scheduleLoanSchema, checkoutLoanSchema } from '$lib/server/db/schema/equipment';

export const getLoan = query(z.string(), async (id) => {
	await requireStaff();
	const loan = await getLoanById(id);
	if (!loan) error(404, 'Loan not found');
	return loan;
});

export const getAvailableEquipment = query(z.void(), async () => {
	await requireStaff();
	const { rows } = await listEquipment({ status: 'available' });
	return rows;
});

export const schedule = form('unchecked', async (data, issue) => {
	await requireStaff();
	const result = scheduleLoanSchema.safeParse(data);
	if (!result.success) {
		const issues = result.error.issues.map((err: any) => {
			const key = String(err.path[0] ?? '');
			return (issue as any)[key]?.(err.message);
		}).filter(Boolean);
		invalid(...issues);
	}
	const { params } = getRequestEvent();
	await scheduleLoan(params.id!, {
		equipmentId: result.data!.equipmentId,
		scheduledPickupDate: result.data!.scheduledPickupDate
	});
	void getLoan(params.id!).refresh();
	return { success: true };
});

export const checkout = form('unchecked', async (data, issue) => {
	await requireStaff();
	const result = checkoutLoanSchema.safeParse(data);
	if (!result.success) {
		const issues = result.error.issues.map((err: any) => {
			const key = String(err.path[0] ?? '');
			return (issue as any)[key]?.(err.message);
		}).filter(Boolean);
		invalid(...issues);
	}
	const { params } = getRequestEvent();
	await checkoutLoan(params.id!, { dueDate: result.data!.dueDate });
	void getLoan(params.id!).refresh();
	return { success: true };
});
