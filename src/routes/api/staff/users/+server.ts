import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAnyRole } from '$lib/server/authorization';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { role, modelHasRole } from '$lib/server/db/schema/authorization';
import { count, desc, like, eq, isNull, or } from 'drizzle-orm';
import { paginate, parsePagination } from '$lib/server/db/paginate';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Staff access required');

	const search = url.searchParams.get('q')?.trim() ?? '';

	const searchCondition = search
		? or(like(user.name, `%${search}%`), like(user.email, `%${search}%`))
		: undefined;

	const activeCondition = isNull(user.deletedAt);
	const where = searchCondition
		? (searchCondition && activeCondition)
		: activeCondition;

	const dataQ = db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			pronouns: user.pronouns,
			createdAt: user.createdAt
		})
		.from(user)
		.where(where)
		.orderBy(desc(user.createdAt))
		.$dynamic();

	const countQ = db.select({ count: count() }).from(user).where(where);

	const { rows: users, pagination } = await paginate(dataQ, countQ, parsePagination(url, 20));

	// Fetch roles for all users on this page
	const userIds = users.map((u) => u.id);
	let roleMap: Record<string, string[]> = {};

	if (userIds.length > 0) {
		const roleRows = await db
			.select({
				userId: modelHasRole.userId,
				roleName: role.name
			})
			.from(modelHasRole)
			.innerJoin(role, eq(role.id, modelHasRole.roleId))
			.where(
				or(...userIds.map((id) => eq(modelHasRole.userId, id)))!
			);

		for (const row of roleRows) {
			if (!roleMap[row.userId]) roleMap[row.userId] = [];
			roleMap[row.userId].push(row.roleName);
		}
	}

	return json({
		users: users.map((u) => ({
			...u,
			roles: roleMap[u.id] ?? []
		})),
		pagination,
		search
	});
};
