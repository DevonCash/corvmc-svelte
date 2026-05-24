import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAnyRole } from '$lib/server/authorization';
import { listAll } from '$lib/server/event/event-service';
import { parsePagination } from '$lib/server/db/paginate';
import { toISO } from '$lib/server/db/schema/columns';
import type { StaffEventsResponse } from '$lib/server/db/schema/api';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Staff access required');

	const { rows, pagination } = await listAll(parsePagination(url));

	return json({
		events: rows.map((e) => ({
			id: e.id,
			title: e.title,
			description: e.description,
			startsAt: toISO(e.startsAt),
			endsAt: toISO(e.endsAt),
			doorsAt: e.doorsAt ? toISO(e.doorsAt) : null,
			publishedAt: e.publishedAt ? toISO(e.publishedAt) : null,
			createdAt: toISO(e.createdAt),
			updatedAt: toISO(e.updatedAt),
			status: e.status,
			tags: e.tags,
			reservationId: e.reservationId,
			ticketingEnabled: e.ticketingEnabled,
			ticketPrice: e.ticketPrice,
			ticketQuantity: e.ticketQuantity,
			posterKey: e.posterKey
		})),
		pagination
	} satisfies StaffEventsResponse);
};
