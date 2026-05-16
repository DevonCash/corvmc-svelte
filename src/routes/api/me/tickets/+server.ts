import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserTickets } from '$lib/server/ticket/ticket-service';
import { db } from '$lib/server/db';
import { event } from '$lib/server/db/schema/event';
import { inArray } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return error(401, 'Not authenticated');

	const tickets = await getUserTickets(locals.user.id);

	// Load event info for all tickets
	const eventIds = [...new Set(tickets.map((t) => t.eventId))];
	let eventMap: Record<string, { title: string; startsAt: Date; endsAt: Date }> = {};

	if (eventIds.length > 0) {
		const events = await db
			.select({
				id: event.id,
				title: event.title,
				startsAt: event.startsAt,
				endsAt: event.endsAt
			})
			.from(event)
			.where(inArray(event.id, eventIds));

		eventMap = Object.fromEntries(
			events.map((e) => [
				e.id,
				{ title: e.title, startsAt: e.startsAt, endsAt: e.endsAt }
			])
		);
	}

	return json({
		tickets: tickets.map((t) => ({
			id: t.id,
			eventId: t.eventId,
			code: t.code,
			status: t.status,
			attendeeName: t.attendeeName,
			checkedInAt: t.checkedInAt ?? null,
			createdAt: t.createdAt,
			event: eventMap[t.eventId] ?? null
		}))
	});
};
