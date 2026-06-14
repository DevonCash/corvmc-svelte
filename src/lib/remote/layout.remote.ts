import { z } from 'zod';
import { error, redirect } from '@sveltejs/kit';
import { query, getRequestEvent } from '$app/server';
import { listForUser, getBySlug, getUserRole } from '$lib/server/band/band-service';
import { hasAnyRole } from '$lib/server/authorization';
import { getAllFeatureFlags } from '$lib/server/feature-flags';
import { getUnresolvedCount } from '$lib/server/inbox/thread-service';
import { resolveImageUrl } from '$lib/server/storage';
import { captureException } from '$lib/server/sentry';

export const getMe = query(async () => {
	try {
		const { locals } = getRequestEvent();
		if (!locals.user) return null;
		return {
			id: locals.user.id,
			name: locals.user.name,
			email: locals.user.email,
			image: resolveImageUrl(locals.user.image)
		};
	} catch (err) {
		captureException(err);
		return null;
	}
});

export const getMemberLayout = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.user) throw redirect(302, '/login');
	const user = locals.user;

	const [userBands, isStaff, features] = await Promise.all([
		listForUser(user.id).catch(() => []),
		hasAnyRole(user.id, ['admin', 'staff']),
		getAllFeatureFlags()
	]);

	return {
		user: { id: user.id, name: user.name, email: user.email },
		userBands: userBands.map((b) => ({
			id: b.id,
			name: b.name,
			slug: b.slug,
			avatarUrl: resolveImageUrl(b.avatarKey),
			role: b.role
		})),
		isStaff,
		features
	};
});

export const getStaffLayout = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.user) throw redirect(302, '/login');

	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) throw redirect(302, '/');

	const user = locals.user;
	const [userBands, features] = await Promise.all([
		listForUser(user.id).catch(() => []),
		getAllFeatureFlags()
	]);

	const inboxUnread = features.staffInbox ? await getUnresolvedCount().catch(() => 0) : 0;

	return {
		user: { id: user.id, name: user.name, email: user.email },
		userBands: userBands.map((b) => ({ id: b.id, name: b.name, slug: b.slug })),
		features,
		inboxUnread
	};
});

export const getBandLayout = query(z.string(), async (slug) => {
	const { locals } = getRequestEvent();
	if (!locals.user) throw redirect(302, '/login');

	const band = await getBySlug(slug);
	if (!band) throw error(404, 'Band not found');

	const [role, isStaff, userBands, features] = await Promise.all([
		getUserRole(band.id, locals.user.id),
		hasAnyRole(locals.user.id, ['admin', 'staff']),
		listForUser(locals.user.id).catch(() => []),
		getAllFeatureFlags()
	]);

	if (!role && !isStaff) {
		throw error(403, 'You are not a member of this band');
	}

	return {
		band: { ...band, avatarUrl: resolveImageUrl(band.avatarKey) },
		userRole: role ?? 'staff',
		isStaff,
		userBands: userBands.map((b) => ({ id: b.id, name: b.name, slug: b.slug })),
		user: { id: locals.user.id, name: locals.user.name, email: locals.user.email },
		features
	};
});
