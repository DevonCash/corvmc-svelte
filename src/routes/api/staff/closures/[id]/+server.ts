import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { closure } from '$lib/server/db/schema/reservation';
import { eq } from 'drizzle-orm';
import { requireStaffRole } from '$lib/server/authorization';

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	await requireStaffRole(locals.user?.id);

	const body = (await request.json()) as {
		reason?: string;
		startsAt?: string;
		endsAt?: string;
	};

	if (!body.reason || !body.startsAt || !body.endsAt) {
		throw error(400, 'Missing required fields');
	}

	const startsAt = new Date(body.startsAt);
	const endsAt = new Date(body.endsAt);

	const [row] = await db
		.select({ startsAt: closure.startsAt })
		.from(closure)
		.where(eq(closure.id, params.id))
		.limit(1);

	if (!row) throw error(404, 'Closure not found');
	if (row.startsAt <= new Date()) throw error(400, 'Cannot edit a past or active closure');
	if (endsAt <= startsAt) throw error(400, 'End time must be after start time');

	await db
		.update(closure)
		.set({ reason: body.reason, startsAt, endsAt })
		.where(eq(closure.id, params.id));

	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	await requireStaffRole(locals.user?.id);

	const [row] = await db
		.select({ startsAt: closure.startsAt })
		.from(closure)
		.where(eq(closure.id, params.id))
		.limit(1);

	if (!row) throw error(404, 'Closure not found');
	if (row.startsAt <= new Date()) throw error(400, 'Cannot delete a past or active closure');

	await db.delete(closure).where(eq(closure.id, params.id));
	return json({ success: true });
};
