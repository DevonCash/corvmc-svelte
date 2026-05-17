import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAnyRole } from '$lib/server/authorization';
import { listTransactions } from '$lib/server/finance/credit-service';

const PAGE_SIZE = 50;

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Staff access required');

	const search = url.searchParams.get('q') ?? '';
	const creditType = url.searchParams.get('creditType') ?? '';
	const source = url.searchParams.get('source') ?? '';
	const from = url.searchParams.get('from') ?? '';
	const to = url.searchParams.get('to') ?? '';
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	const { rows, total } = await listTransactions(
		{
			search: search || undefined,
			creditType: creditType || undefined,
			source: source || undefined,
			from: from || undefined,
			to: to || undefined
		},
		PAGE_SIZE,
		(page - 1) * PAGE_SIZE
	);

	return json({
		transactions: rows,
		total,
		page,
		totalPages: Math.ceil(total / PAGE_SIZE),
		filters: { search, creditType, source, from, to }
	});
};
