import { z } from 'zod';
import { form } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { requireStaff } from '$lib/server/authorization';
import { db } from '$lib/server/db';
import { closure } from '$lib/server/db/schema/reservation';

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
