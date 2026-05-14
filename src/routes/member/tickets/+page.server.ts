import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserTickets } from '$lib/server/ticket/ticket-service';
import { db } from '$lib/server/db';
import { event } from '$lib/server/db/schema/event';
import { eq, inArray } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) return redirect(302, '/demo/better-auth/login');

	const tickets = await getUserTickets(locals.user.id);

	// Load event info for all tickets
	const eventIds = [...new Set(tickets.map((t) => t.eventId))];
	let eventMap: Record<string, { title: string; startsAt: string; endsAt: string }> = {};

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
				{ title: e.title, startsAt: e.startsAt.toISOString(), endsAt: e.endsAt.toISOString() }
			])
		);
	}

	return {
		tickets: tickets.map((t) => ({
			id: t.id,
			eventId: t.eventId,
			code: t.code,
			status: t.status,
			attendeeName: t.attendeeName,
			checkedInAt: t.checkedInAt?.toISOString() ?? null,
			createdAt: t.createdAt.toISOString(),
			event: eventMap[t.eventId] ?? null
		}))
	};
};
