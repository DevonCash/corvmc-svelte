import { z } from 'zod';
import { command, form } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { requireStaff } from '$lib/server/authorization';
import { db } from '$lib/server/db';
import { closure } from '$lib/server/db/schema/reservation';
import { eq } from 'drizzle-orm';

const createClosureSchema = z.object({
	reason: z.string().min(1).max(255),
	startsAt: z.coerce.date(),
	endsAt: z.coerce.date()
});

export const createClosure = form('unchecked', async (data, issue) => {
	await requireStaff();
	const result = createClosureSchema.safeParse(data);
	if (!result.success) {
		invalid(
			...result.error.issues.map((err) => {
				const key = String(err.path[0]);
				return (issue as any)[key]?.(err.message);
			}).filter(Boolean)
		);
	}
	const { reason, startsAt, endsAt } = result.data!;

	if (endsAt <= startsAt) {
		invalid((issue as any).endsAt('End time must be after start time'));
	}

	await db.insert(closure).values({ reason, startsAt, endsAt });
	return { success: true };
});

export const deleteClosure = command(
	z.object({ closureId: z.string() }),
	async ({ closureId }) => {
		await requireStaff();

		const [row] = await db
			.select({ startsAt: closure.startsAt })
			.from(closure)
			.where(eq(closure.id, closureId))
			.limit(1);

		if (!row) throw new Error('Closure not found');
		if (row.startsAt <= new Date()) throw new Error('Cannot delete a past or active closure');

		await db.delete(closure).where(eq(closure.id, closureId));
		return { success: true };
	}
);
