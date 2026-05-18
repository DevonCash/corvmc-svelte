import { z } from 'zod';
import { command, query } from '$app/server';
import { requireStaff } from '$lib/server/authorization';
import { requestLoan } from '$lib/server/equipment/loan-service';
import { listEquipment } from '$lib/server/equipment/equipment-service';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { like, and, sql, or } from 'drizzle-orm';

export const searchMembers = query(z.string(), async (q) => {
	await requireStaff();
	if (!q || q.length < 2) return [];
	const pattern = `%${q}%`;
	return db
		.select({ id: user.id, name: user.name, email: user.email })
		.from(user)
		.where(and(or(like(user.name, pattern), like(user.email, pattern)), sql`${user.deletedAt} is null`))
		.limit(10);
});

export const getEquipmentOptions = query(z.void(), async () => {
	await requireStaff();
	const { rows } = await listEquipment({ status: 'available' });
	return rows.map((e) => ({ id: e.id, name: e.name }));
});

export const createLoanForMember = command(
	z.object({
		userId: z.string().min(1),
		equipmentId: z.string().optional(),
		quantity: z.number().int().min(1).max(20).default(1),
		requestedPickupDate: z.coerce.date(),
		estimatedReturnDate: z.coerce.date(),
		memberNotes: z.string().max(1000).optional()
	}),
	async (data) => {
		await requireStaff();
		await requestLoan(data.userId, {
			equipmentId: data.equipmentId,
			quantity: data.quantity,
			requestedPickupDate: data.requestedPickupDate,
			estimatedReturnDate: data.estimatedReturnDate,
			memberNotes: data.memberNotes
		});
		return { success: true };
	}
);
