import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAnyRole } from '$lib/server/authorization';
import { list } from '$lib/server/finance/payment-record-service';

const PAGE_SIZE = 50;

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Staff access required');

	const search = url.searchParams.get('q') ?? '';
	const method = url.searchParams.get('method') ?? '';
	const status = url.searchParams.get('status') ?? '';
	const from = url.searchParams.get('from') ?? '';
	const to = url.searchParams.get('to') ?? '';
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	const { rows, total } = await list(
		{
			search: search || undefined,
			method: method || undefined,
			status: status || undefined,
			from: from || undefined,
			to: to || undefined
		},
		PAGE_SIZE,
		(page - 1) * PAGE_SIZE
	);

	return json({
		payments: rows,
		total,
		page,
		totalPages: Math.ceil(total / PAGE_SIZE),
		filters: { search, method, status, from, to }
	});
};
