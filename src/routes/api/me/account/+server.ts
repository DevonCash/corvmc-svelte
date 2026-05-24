import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { eq } from 'drizzle-orm';
import { hasAnyRole } from '$lib/server/authorization';
import type { AccountResponse } from '$lib/server/db/schema/api';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return error(401, 'Not authenticated');

	const [row, isStaff] = await Promise.all([
		db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				pronouns: user.pronouns,
				phone: user.phone
			})
			.from(user)
			.where(eq(user.id, locals.user.id))
			.then((rows) => rows[0]),
		hasAnyRole(locals.user.id, ['admin', 'staff'])
	]);

	if (!row) throw error(404, 'User not found');

	return json({
		user: {
			id: row.id,
			name: row.name,
			email: row.email,
			pronouns: row.pronouns,
			phone: row.phone
		},
		isStaff
	} satisfies AccountResponse);
};
