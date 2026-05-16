import { z } from 'zod';
import { command, form } from '$app/server';
import { requireStaff } from '$lib/server/authorization';
import {
	createEquipment,
	createCategory,
	updateCategory,
	deleteCategory
} from '$lib/server/equipment/equipment-service';
import { createEquipmentSchema, createCategorySchema, updateCategorySchema } from '$lib/server/equipment/types';

export const addEquipment = form(createEquipmentSchema, async (data) => {
	await requireStaff();
	const item = await createEquipment(data);
	return { equipmentId: item.id };
});

export const addCategory = command(createCategorySchema, async (data) => {
	await requireStaff();
	const cat = await createCategory(data);
	return { categoryId: cat.id };
});

export const editCategory = command(
	updateCategorySchema.extend({ id: z.string().uuid() }),
	async ({ id, ...data }) => {
		await requireStaff();
		await updateCategory(id, data);
		return { success: true };
	}
);

export const removeCategory = command(z.object({ id: z.string().uuid() }), async ({ id }) => {
	await requireStaff();
	await deleteCategory(id);
	return { success: true };
});
