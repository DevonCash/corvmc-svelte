import type { PageServerLoad } from './$types';
import { listAll } from '$lib/server/event/event-service';

export const load: PageServerLoad = async () => {
	const events = await listAll();

	return {
		events: events.map((e) => ({
			...e,
			startsAt: e.startsAt.toISOString(),
			endsAt: e.endsAt.toISOString(),
			doorsAt: e.doorsAt?.toISOString() ?? null,
			publishedAt: e.publishedAt?.toISOString() ?? null,
			createdAt: e.createdAt.toISOString(),
			updatedAt: e.updatedAt.toISOString()
		}))
	};
};
