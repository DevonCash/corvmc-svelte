import { error } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { requireUser } from '$lib/server/authorization';
import { getBySlug, getUserRole } from '$lib/server/band/band-service';

/**
 * Resolve a band from the current request's `params.slug`.
 * Throws 404 if not found.
 */
export async function requireBandBySlug() {
	const { params } = getRequestEvent();
	const band = await getBySlug(params.slug!);
	if (!band) throw error(404, 'Band not found');
	return band;
}

/**
 * Require that the current user is a member of the band (resolved from slug).
 * Returns { user, band, role }.
 */
export async function requireBandMember() {
	const user = requireUser();
	const band = await requireBandBySlug();
	const role = await getUserRole(band.id, user.id);
	if (!role) throw error(403, 'Not a member of this band');
	return { user, band, role };
}

const HIERARCHY: Record<string, number> = { owner: 0, admin: 1, member: 2 };

/**
 * Require that the current user holds at least `minRole` in the band.
 * Role hierarchy: owner > admin > member.
 */
export async function requireBandRole(minRole: 'owner' | 'admin' | 'member') {
	const ctx = await requireBandMember();
	if (HIERARCHY[ctx.role] > HIERARCHY[minRole]) {
		throw error(403, 'Insufficient permissions');
	}
	return ctx;
}

/** Shorthand: require at least admin role in the band. */
export async function requireBandAdmin() {
	return requireBandRole('admin');
}

/** Shorthand: require owner role in the band. */
export async function requireBandOwner() {
	return requireBandRole('owner');
}
