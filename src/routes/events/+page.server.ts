import type { PageServerLoad } from './$types';
import { listUpcoming } from '$lib/server/event/event-service';
import { getPublicUrl, isConfigured } from '$lib/server/storage';

export const load: PageServerLoad = async () => {
	const events = await listUpcoming();
	const r2Available = isConfigured();

	return {
		events: events.map((e) => ({
			id: e.id,
			title: e.title,
			description: e.description,
			startsAt: e.startsAt.toISOString(),
			endsAt: e.endsAt.toISOString(),
			doorsAt: e.doorsAt?.toISOString() ?? null,
			tags: e.tags,
			posterUrl: e.posterKey && r2Available ? getPublicUrl(e.posterKey) : null
		}))
	};
};
