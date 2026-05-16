import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { db } from '$lib/server/db';
import { closure } from '$lib/server/db/schema/reservation';
import { eq } from 'drizzle-orm';

export const actions: Actions = {
	create: async ({ request }) => {
		const formData = await request.formData();
		const reason = formData.get('reason') as string;
		const startsAt = formData.get('startsAt') as string;
		const endsAt = formData.get('endsAt') as string;

		if (!reason || !startsAt || !endsAt) {
			return fail(400, { error: 'All fields are required' });
		}

		const start = new Date(startsAt);
		const end = new Date(endsAt);

		if (end <= start) {
			return fail(400, { error: 'End time must be after start time' });
		}

		await db.insert(closure).values({
			reason,
			startsAt: start,
			endsAt: end
		});

		return { success: true };
	},

	delete: async ({ request }) => {
		const formData = await request.formData();
		const id = formData.get('closureId') as string;
		if (!id) return fail(400, { error: 'Missing closure ID' });

		// Only allow deleting future closures
		const [row] = await db
			.select({ startsAt: closure.startsAt })
			.from(closure)
			.where(eq(closure.id, id))
			.limit(1);

		if (!row) return fail(404, { error: 'Closure not found' });
		if (row.startsAt <= new Date()) {
			return fail(400, { error: 'Cannot delete a past or active closure' });
		}

		await db.delete(closure).where(eq(closure.id, id));
		return { success: true };
	}
};
