import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { role, permission } from '$lib/server/db/schema/authorization';
import { count, desc, gte } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
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

	return {
		stats: {
			totalUsers: totalUsersResult[0].value,
			totalRoles: totalRolesResult[0].value,
			totalPermissions: totalPermissionsResult[0].value,
			newUsersThisMonth: newUsersResult[0].value
		},
		recentUsers
	};
};
