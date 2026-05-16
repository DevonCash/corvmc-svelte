import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { closure } from '$lib/server/db/schema/reservation';
import { eq } from 'drizzle-orm';
import { hasAnyRole } from '$lib/server/authorization';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) return json({ error: 'Not authenticated' }, { status: 401 });

	const isStaff = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!isStaff) return json({ error: 'Forbidden' }, { status: 403 });

	// Only allow deleting future closures
	const [row] = await db
		.select({ startsAt: closure.startsAt })
		.from(closure)
		.where(eq(closure.id, params.id))
		.limit(1);

	if (!row) return json({ error: 'Closure not found' }, { status: 404 });
	if (row.startsAt <= new Date()) {
		return json({ error: 'Cannot delete a past or active closure' }, { status: 400 });
	}

	await db.delete(closure).where(eq(closure.id, params.id));
	return json({ success: true });
};
