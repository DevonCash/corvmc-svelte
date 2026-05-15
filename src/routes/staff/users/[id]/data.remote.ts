import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, form, getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { role, modelHasRole } from '$lib/server/db/schema/authorization';
import { eq } from 'drizzle-orm';
import { getUserRoles } from '$lib/server/authorization';
import { listByUser } from '$lib/server/finance/payment-record-service';

export const getUser = query(z.string(), async (id) => {
	const [found] = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			pronouns: user.pronouns,
			phone: user.phone,
			stripeId: user.stripeId,
			createdAt: user.createdAt,
			deletedAt: user.deletedAt
		})
		.from(user)
		.where(eq(user.id, id))
		.limit(1);

	if (!found) error(404, 'User not found');

	const roles = await getUserRoles(id);

	return { ...found, roles };
});

export const getAllRoles = query(async () => {
	return db.select({ id: role.id, name: role.name }).from(role);
});

export const getUserPayments = query(z.string(), async (userId) => {
	return listByUser(userId);
});

const updateUserSchema = z.object({
	name: z.string().trim().min(1),
	pronouns: z.string().trim(),
	phone: z.string().trim(),
	roles: z.string().transform((s) => JSON.parse(s) as string[]).pipe(
		z.array(z.string().regex(/^\d+$/, 'Invalid role ID'))
	).default([])
});

export const updateUser = form(updateUserSchema, async (rawData) => {
	const data = rawData as z.infer<typeof updateUserSchema>;
	const { params } = getRequestEvent();
	const id = params.id!;
	const roleIds = data.roles.map(Number);

	await db.transaction(async (tx) => {
		await tx
			.update(user)
			.set({
				name: data.name,
				pronouns: data.pronouns || null,
				phone: data.phone || null,
				updatedAt: new Date()
			})
			.where(eq(user.id, id));

		await tx.delete(modelHasRole).where(eq(modelHasRole.userId, id));

		if (roleIds.length > 0) {
			await tx.insert(modelHasRole).values(
				roleIds.map((roleId: number) => ({
					roleId,
					userId: id
				}))
			);
		}
	});

	// Refresh the user query so the page gets fresh data
	void getUser(id).refresh();

	return { success: true };
});
