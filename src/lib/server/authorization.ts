import { error } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
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
 * Assert the current request is from an authenticated user with a staff or admin role.
 * Throws 401/403 via SvelteKit error() if not.
 * Returns the authenticated user for convenience.
 */
export async function requireStaff() {
	const { locals } = getRequestEvent();
	if (!locals.user) throw error(401, 'Not authenticated');
	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) throw error(403, 'Staff access required');
	return locals.user;
}

/**
 * Assert the current request is from an authenticated user.
 * Throws 401 via SvelteKit error() if not.
 * Returns the authenticated user for convenience.
 */
export async function requireMember() {
	const { locals } = getRequestEvent();
	if (!locals.user) throw error(401, 'Not authenticated');
	return locals.user;
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

/**
 * Assign a role to a user. No-op if already assigned.
 */
export async function assignRole(userId: string, roleName: string): Promise<void> {
	const [found] = await db
		.select({ id: role.id })
		.from(role)
		.where(eq(role.name, roleName))
		.limit(1);

	if (!found) return;

	await db
		.insert(modelHasRole)
		.values({ roleId: found.id, userId })
		.onConflictDoNothing();
}

/**
 * Remove a role from a user. No-op if not assigned.
 */
export async function removeRole(userId: string, roleName: string): Promise<void> {
	const [found] = await db
		.select({ id: role.id })
		.from(role)
		.where(eq(role.name, roleName))
		.limit(1);

	if (!found) return;

	await db
		.delete(modelHasRole)
		.where(and(eq(modelHasRole.roleId, found.id), eq(modelHasRole.userId, userId)));
}
