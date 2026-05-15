import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { eq } from 'drizzle-orm';
import { hasAnyRole } from '$lib/server/authorization';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) throw error(401, 'Not authenticated');

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
			.where(eq(user.id, event.locals.user.id))
			.then((rows) => rows[0]),
		hasAnyRole(event.locals.user.id, ['admin', 'staff'])
	]);

	if (!row) throw error(404, 'User not found');

	return {
		user: {
			...row,
			pronouns: row.pronouns ?? undefined,
			phone: row.phone ?? undefined
		},
		isStaff
	};
};
