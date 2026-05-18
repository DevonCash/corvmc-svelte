import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAnyRole } from '$lib/server/authorization';
import { list } from '$lib/server/finance/payment-cache-service';
import { parsePagination } from '$lib/server/db/paginate';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Staff access required');

	const search = url.searchParams.get('q') ?? '';
	const method = url.searchParams.get('method') ?? '';
	const status = url.searchParams.get('status') ?? '';
	const from = url.searchParams.get('from') ?? '';
	const to = url.searchParams.get('to') ?? '';

	const { rows, pagination } = await list(
		{
			search: search || undefined,
			method: method || undefined,
			status: status || undefined,
			from: from || undefined,
			to: to || undefined
		},
		parsePagination(url)
	);

	return json({
		payments: rows,
		pagination,
		filters: { search, method, status, from, to }
	});
};
