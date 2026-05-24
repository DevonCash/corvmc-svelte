import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listUpcoming } from '$lib/server/event/event-service';
import { getPublicUrl, isConfigured } from '$lib/server/storage';
import { toISO } from '$lib/server/db/schema/columns';
import type { EventsResponse } from '$lib/server/db/schema/api';

export const GET: RequestHandler = async () => {
	const events = await listUpcoming();
	const r2Available = isConfigured();

	return json({
		events: events.map((e) => ({
			id: e.id,
			title: e.title,
			description: e.description,
			startsAt: toISO(e.startsAt),
			endsAt: toISO(e.endsAt),
			doorsAt: e.doorsAt ? toISO(e.doorsAt) : null,
			tags: e.tags,
			posterUrl: e.posterKey && r2Available ? getPublicUrl(e.posterKey) : null,
			ticketingEnabled: e.ticketingEnabled,
			ticketPrice: e.ticketPrice
		}))
	} satisfies EventsResponse);
};
