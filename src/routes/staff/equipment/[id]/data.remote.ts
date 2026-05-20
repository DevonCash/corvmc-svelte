import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, form, getRequestEvent } from '$app/server';
import { requireStaff } from '$lib/server/authorization';
import {
	getEquipmentById,
	updateEquipment,
	listCategories
} from '$lib/server/equipment/equipment-service';
import { getLoanHistory } from '$lib/server/equipment/loan-service';
import { equipmentConditions, equipmentStatuses } from '$lib/config';

const editEquipmentSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	description: z.string().max(2000).optional(),
	categoryId: z.string().uuid().optional(),
	totalQuantity: z.string().optional(),
	outOfOrderQuantity: z.string().optional(),
	serialNumber: z.string().max(100).optional(),
	resourceId: z.string().max(100).optional(),
	condition: z.enum(equipmentConditions).optional(),
	status: z.enum(equipmentStatuses).optional(),
	notes: z.string().max(2000).optional()
});

export const getEquipment = query(z.string(), async (id) => {
	await requireStaff();
	const item = await getEquipmentById(id);
	if (!item) error(404, 'Equipment not found');
	return item;
});

export const getCategories = query(z.void(), async () => {
	await requireStaff();
	return listCategories();
});

export const getEquipmentLoanHistory = query(z.string(), async (equipmentId) => {
	await requireStaff();
	return getLoanHistory(equipmentId);
});

export const editEquipment = form(editEquipmentSchema, async (raw) => {
	await requireStaff();
	const data = raw as z.infer<typeof editEquipmentSchema>;
	const { params } = getRequestEvent();
	const id = params.id!;
	await updateEquipment(id, {
		...data,
		totalQuantity: data.totalQuantity ? parseInt(data.totalQuantity, 10) : undefined,
		outOfOrderQuantity: data.outOfOrderQuantity ? parseInt(data.outOfOrderQuantity, 10) : undefined
	});
	void getEquipment(id).refresh();
	return { success: true };
});
