import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAnyRole } from '$lib/server/authorization';
import { listAll } from '$lib/server/reservation/recurring-series-service';
import { parsePagination } from '$lib/server/db/paginate';
import { toISO } from '$lib/server/db/schema/columns';
import type { StaffRecurringResponse } from '$lib/server/db/schema/api';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Staff access required');

	const filter = url.searchParams.get('filter') ?? 'active';

	const { rows, pagination } = await listAll({ filter }, parsePagination(url));

	return json({
		series: rows.map((s) => ({
			id: s.id,
			userName: s.userName,
			userPronouns: s.userPronouns,
			userRole: s.userRole,
			frequencyLabel: s.frequencyLabel,
			bookerType: s.bookerType,
			startsAt: toISO(s.startsAt),
			endsAt: toISO(s.endsAt),
			createdAt: toISO(s.createdAt),
			cancelledAt: s.cancelledAt ? toISO(s.cancelledAt) : null
		})),
		pagination,
		filter
	} satisfies StaffRecurringResponse);
};
