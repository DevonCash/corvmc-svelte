import { db } from '$lib/server/db';
import { role, modelHasRole } from '$lib/server/db/schema/authorization';
import { eq, and } from 'drizzle-orm';

/**
 * Check whether a user has a specific role.
 */
export async function hasRole(userId: string, roleName: string): Promise<boolean> {
	const result = await db
		.select({ roleId: role.id })
		.from(role)
		.innerJoin(modelHasRole, eq(modelHasRole.roleId, role.id))
		.where(and(eq(role.name, roleName), eq(modelHasRole.userId, userId)))
		.limit(1);

	return result.length > 0;
}

/**
 * Check whether a user has any of the given roles.
 */
export async function hasAnyRole(userId: string, roleNames: string[]): Promise<boolean> {
	for (const name of roleNames) {
		if (await hasRole(userId, name)) return true;
	}
	return false;
}

/**
 * Get all role names for a user.
 */
export async function getUserRoles(userId: string): Promise<string[]> {
	const rows = await db
		.select({ name: role.name })
		.from(role)
		.innerJoin(modelHasRole, eq(modelHasRole.roleId, role.id))
		.where(eq(modelHasRole.userId, userId));

	return rows.map((r) => r.name);
}
