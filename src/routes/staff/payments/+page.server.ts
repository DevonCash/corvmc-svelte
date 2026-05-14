import type { PageServerLoad } from './$types';
import { list } from '$lib/server/finance/payment-record-service';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ url }) => {
	const search = url.searchParams.get('q') ?? '';
	const method = url.searchParams.get('method') ?? '';
	const status = url.searchParams.get('status') ?? '';
	const from = url.searchParams.get('from') ?? '';
	const to = url.searchParams.get('to') ?? '';
	const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));

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

	return {
		payments: rows,
		total,
		page,
		pageSize: PAGE_SIZE,
		totalPages: Math.ceil(total / PAGE_SIZE),
		filters: { search, method, status, from, to }
	};
};
