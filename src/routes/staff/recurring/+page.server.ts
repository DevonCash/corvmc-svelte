import type { PageServerLoad, Actions } from './$types';
import { listAll, cancel } from '$lib/server/reservation/recurring-series-service';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url }) => {
	const filter = url.searchParams.get('filter') ?? 'active';
	const allSeries = await listAll();

	const filtered = filter === 'active'
		? allSeries.filter((s) => !s.cancelledAt)
		: filter === 'cancelled'
			? allSeries.filter((s) => s.cancelledAt)
			: allSeries;

	return {
		series: filtered.map((s) => ({
			id: s.id,
			userName: s.userName,
			frequencyLabel: s.frequencyLabel,
			bookerType: s.bookerType,
			startsAt: s.startsAt.toISOString(),
			endsAt: s.endsAt.toISOString(),
			createdAt: s.createdAt.toISOString(),
			cancelledAt: s.cancelledAt?.toISOString() ?? null
		})),
		filter
	};
};

export const actions: Actions = {
	cancel: async ({ request }) => {
		const formData = await request.formData();
		const seriesId = formData.get('seriesId') as string;

		if (!seriesId) {
			return fail(400, { error: 'Missing series ID' });
		}

		try {
			await cancel(seriesId);
		} catch (err) {
			return fail(400, { error: err instanceof Error ? err.message : 'Failed to cancel series' });
		}

		return { success: true };
	}
};
