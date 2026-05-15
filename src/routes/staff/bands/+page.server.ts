import { listAll } from '$lib/server/band/band-service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const search = url.searchParams.get('q')?.trim() ?? '';
	const status = url.searchParams.get('status') as 'active' | 'deactivated' | undefined;

	const bands = await listAll({
		search: search || undefined,
		status: status === 'active' || status === 'deactivated' ? status : undefined
	});

	return {
		bands: bands.map((b) => ({
			...b,
			createdAt: b.createdAt.toISOString(),
			deletedAt: b.deletedAt?.toISOString() ?? null
		})),
		filters: { search, status: status ?? '' }
	};
};
