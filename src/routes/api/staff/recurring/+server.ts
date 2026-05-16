import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAnyRole } from '$lib/server/authorization';
import { listAll } from '$lib/server/reservation/recurring-series-service';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Staff access required');

	const filter = url.searchParams.get('filter') ?? 'active';
	const allSeries = await listAll();

	const filtered = filter === 'active'
		? allSeries.filter((s) => !s.cancelledAt)
		: filter === 'cancelled'
			? allSeries.filter((s) => s.cancelledAt)
			: allSeries;

	return json({
		series: filtered.map((s) => ({
			id: s.id,
			userName: s.userName,
			userPronouns: s.userPronouns,
			userRole: s.userRole,
			frequencyLabel: s.frequencyLabel,
			bookerType: s.bookerType,
			startsAt: s.startsAt.toISOString(),
			endsAt: s.endsAt.toISOString(),
			createdAt: s.createdAt.toISOString(),
			cancelledAt: s.cancelledAt?.toISOString() ?? null
		})),
		filter
	});
};
