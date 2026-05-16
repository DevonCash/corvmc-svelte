import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { closure } from '$lib/server/db/schema/reservation';
import { hasAnyRole } from '$lib/server/authorization';
import { desc } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Staff access required');

	const closures = await db
		.select()
		.from(closure)
		.orderBy(desc(closure.startsAt));

	return json({
		closures: closures.map((c) => ({
			id: c.id,
			reason: c.reason,
			startsAt: c.startsAt.toISOString(),
			endsAt: c.endsAt.toISOString()
		}))
	});
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) return json({ error: 'Not authenticated' }, { status: 401 });

	const isStaff = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!isStaff) return json({ error: 'Forbidden' }, { status: 403 });

	const formData = await request.formData();
	const reason = formData.get('reason') as string;
	const startsAt = formData.get('startsAt') as string;
	const endsAt = formData.get('endsAt') as string;

	if (!reason || !startsAt || !endsAt) {
		return json({ error: 'All fields are required' }, { status: 400 });
	}

	const start = new Date(startsAt);
	const end = new Date(endsAt);

	if (end <= start) {
		return json({ error: 'End time must be after start time' }, { status: 400 });
	}

	await db.insert(closure).values({
		reason,
		startsAt: start,
		endsAt: end
	});

	return json({ success: true });
};
