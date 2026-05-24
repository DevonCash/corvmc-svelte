import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAnyRole } from '$lib/server/authorization';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { role, permission } from '$lib/server/db/schema/authorization';
import { count, desc, gte } from 'drizzle-orm';
import { toISO } from '$lib/server/db/schema/columns';
import type { StaffDashboardResponse } from '$lib/server/db/schema/api';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Staff access required');

	const startOfMonth = new Date();
	startOfMonth.setDate(1);
	startOfMonth.setHours(0, 0, 0, 0);

	const [totalUsersResult, totalRolesResult, totalPermissionsResult, newUsersResult, recentUsers] =
		await Promise.all([
			db.select({ value: count() }).from(user),
			db.select({ value: count() }).from(role),
			db.select({ value: count() }).from(permission),
			db.select({ value: count() }).from(user).where(gte(user.createdAt, startOfMonth)),
			db
				.select({
					id: user.id,
					name: user.name,
					email: user.email,
					createdAt: user.createdAt
				})
				.from(user)
				.orderBy(desc(user.createdAt))
				.limit(5)
		]);

	return json({
		stats: {
			totalUsers: totalUsersResult[0].value,
			totalRoles: totalRolesResult[0].value,
			totalPermissions: totalPermissionsResult[0].value,
			newUsersThisMonth: newUsersResult[0].value
		},
		recentUsers: recentUsers.map((u) => ({
			id: u.id,
			name: u.name,
			email: u.email,
			createdAt: toISO(u.createdAt)
		}))
	} satisfies StaffDashboardResponse);
};
