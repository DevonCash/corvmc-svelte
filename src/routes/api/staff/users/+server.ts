import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAnyRole } from '$lib/server/authorization';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { role, modelHasRole } from '$lib/server/db/schema/authorization';
import { count, desc, like, eq, isNull, or } from 'drizzle-orm';

const PAGE_SIZE = 20;

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Staff access required');

	const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
	const search = url.searchParams.get('q')?.trim() ?? '';
	const offset = (page - 1) * PAGE_SIZE;

	// Build where clause
	const searchCondition = search
		? or(like(user.name, `%${search}%`), like(user.email, `%${search}%`))
		: undefined;

	// Exclude soft-deleted users
	const activeCondition = isNull(user.deletedAt);
	const where = searchCondition
		? (searchCondition && activeCondition)
		: activeCondition;

	const [totalResult, users] = await Promise.all([
		db.select({ value: count() }).from(user).where(where),
		db
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
			.limit(PAGE_SIZE)
			.offset(offset)
	]);

	const total = totalResult[0].value;

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
		pagination: {
			page,
			pageSize: PAGE_SIZE,
			total,
			totalPages: Math.ceil(total / PAGE_SIZE)
		},
		search
	});
};
