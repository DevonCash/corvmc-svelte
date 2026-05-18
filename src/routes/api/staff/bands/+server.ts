import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAnyRole } from '$lib/server/authorization';
import { listAll } from '$lib/server/band/band-service';
import { parsePagination } from '$lib/server/db/paginate';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Staff access required');

	const search = url.searchParams.get('q')?.trim() ?? '';
	const status = url.searchParams.get('status') as 'active' | 'deactivated' | undefined;

	const { rows, pagination } = await listAll(
		{
			search: search || undefined,
			status: status === 'active' || status === 'deactivated' ? status : undefined
		},
		parsePagination(url)
	);

	return json({
		bands: rows.map((b) => ({
			...b,
			createdAt: b.createdAt.toISOString(),
			deletedAt: b.deletedAt?.toISOString() ?? null
		})),
		pagination,
		filters: { search, status: status ?? '' }
	});
};
