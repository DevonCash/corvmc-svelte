import { z } from 'zod';
import { command, form } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { requireStaff } from '$lib/server/authorization';
import {
	createCategory,
	updateCategory
} from '$lib/server/equipment/equipment-service';
import { createCategorySchema, updateCategorySchema } from '$lib/server/db/schema/equipment';

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
