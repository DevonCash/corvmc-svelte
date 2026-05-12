import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, form, getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { role, modelHasRole } from '$lib/server/db/schema/authorization';
import { eq } from 'drizzle-orm';
import { getUserRoles } from '$lib/server/authorization';

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

export const updateUser = form(
	z.object({
		name: z.string().trim().min(1),
		pronouns: z.string().trim(),
		phone: z.string().trim(),
		roles: z.preprocess(
			(val) => (val == null ? [] : Array.isArray(val) ? val : [val]),
			z.array(z.string())
		)
	}),
	async (data) => {
		const { params } = getRequestEvent();
		const id = params.id!;

		await db
			.update(user)
			.set({
				name: data.name,
				pronouns: data.pronouns || null,
				phone: data.phone || null,
				updatedAt: new Date()
			})
			.where(eq(user.id, id));

		// Replace roles
		const roleIds = data.roles.map(Number);
		await db.delete(modelHasRole).where(eq(modelHasRole.userId, id));

		if (roleIds.length > 0) {
			await db.insert(modelHasRole).values(
				roleIds.map((roleId) => ({
					roleId,
					userId: id
				}))
			);
		}

		// Refresh the user query so the page gets fresh data
		void getUser(id).refresh();

		return { success: true };
	}
);
