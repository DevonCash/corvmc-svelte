import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAnyRole } from '$lib/server/authorization';
import { listTransactions } from '$lib/server/finance/credit-service';
import { parsePagination } from '$lib/server/db/paginate';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Staff access required');

	const search = url.searchParams.get('q') ?? '';
	const creditType = url.searchParams.get('creditType') ?? '';
	const source = url.searchParams.get('source') ?? '';
	const from = url.searchParams.get('from') ?? '';
	const to = url.searchParams.get('to') ?? '';

	const { rows, pagination } = await listTransactions(
		{
			search: search || undefined,
			creditType: creditType || undefined,
			source: source || undefined,
			from: from || undefined,
			to: to || undefined
		},
		parsePagination(url)
	);

	return json({
		transactions: rows,
		pagination,
		filters: { search, creditType, source, from, to }
	});
};
