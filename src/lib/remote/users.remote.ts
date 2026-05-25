import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, form, getRequestEvent } from '$app/server';
import { requireStaff } from '$lib/server/authorization';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/authentication';
import { role, modelHasRole } from '$lib/server/db/schema/authorization';
import { eq } from 'drizzle-orm';
import { getUserRoles } from '$lib/server/authorization';
import { listByUser } from '$lib/server/finance/payment-cache-service';
import { getAllBalances, addCredits, deductCredits } from '$lib/server/finance/credit-service';
import type { CreditType } from '$lib/server/db/schema/finance';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

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

export const getUserCredits = query(z.string(), async (userId) => {
	return getAllBalances(userId);
});

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

const updateUserSchema = z.object({
	name: z.string().trim().min(1).max(255),
	pronouns: z.string().trim().max(50),
	phone: z.string().trim().max(30),
	roles: z
		.string()
		.transform((s) => JSON.parse(s) as string[])
		.pipe(z.array(z.string().regex(/^\d+$/, 'Invalid role ID')))
		.default([])
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

	void getUser(id).refresh();

	return { success: true };
});

export const adjustCredits = form(
	z.object({
		userId: z.string(),
		creditType: z.enum(['free_hours', 'equipment_credits']),
		amount: z.string(),
		description: z.string().min(1)
	}),
	async (data) => {
		await requireStaff();

		const userId = data.userId as string;
		const type = data.creditType as CreditType;
		const amount = Number(data.amount);
		const description = data.description as string;

		if (amount === 0) throw error(400, 'Amount cannot be zero');

		if (amount > 0) {
			await addCredits(userId, type, amount, 'admin_adjustment', undefined, description);
		} else {
			await deductCredits(
				userId,
				type,
				Math.abs(amount),
				'admin_adjustment',
				undefined,
				description
			);
		}

		void getUserCredits(userId).refresh();
		return { success: true };
	}
);

export const getLocalUser = query(async () => {
	const { locals } = await getRequestEvent();

	return locals.user;
});
