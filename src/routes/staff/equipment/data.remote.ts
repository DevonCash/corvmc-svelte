import { z } from 'zod';
import { command, form } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { requireStaff } from '$lib/server/authorization';
import {
	createEquipment,
	createCategory,
	updateCategory,
	deleteCategory
} from '$lib/server/equipment/equipment-service';
import { createEquipmentSchema, createCategorySchema, updateCategorySchema } from '$lib/server/equipment/types';

export const addEquipment = form('unchecked', async (data, issue) => {
	await requireStaff();
	const result = createEquipmentSchema.safeParse(data);
	if (!result.success) {
		invalid(
			...result.error.issues.map((err) => {
				const key = String(err.path[0]);
				return (issue as any)[key]?.(err.message);
			}).filter(Boolean)
		);
	}
	const item = await createEquipment(result.data!);
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
