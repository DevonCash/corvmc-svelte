import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAnyRole } from '$lib/server/authorization';
import { listTransactions } from '$lib/server/finance/credit-service';
import { parsePagination } from '$lib/server/db/paginate';
import { creditTypes, transactionSources, type CreditType, type TransactionSource } from '$lib/server/db/schema/finance';
import type { ISODateString } from '$lib/server/db/schema/columns';
import type { StaffCreditsResponse } from '$lib/server/db/schema/api';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Staff access required');

	const search = url.searchParams.get('q') ?? '';
	const creditTypeParam = url.searchParams.get('creditType') ?? '';
	const sourceParam = url.searchParams.get('source') ?? '';
	const from = url.searchParams.get('from') ?? '';
	const to = url.searchParams.get('to') ?? '';

	const creditType = (creditTypes as readonly string[]).includes(creditTypeParam) ? creditTypeParam as (typeof creditTypes)[number] : undefined;
	const source = (transactionSources as readonly string[]).includes(sourceParam) ? sourceParam as (typeof transactionSources)[number] : undefined;

	const { rows, pagination } = await listTransactions(
		{
			search: search || undefined,
			creditType,
			source,
			from: from || undefined,
			to: to || undefined
		},
		parsePagination(url)
	);

	return json({
		transactions: rows.map((r) => ({
			...r,
			creditType: r.creditType as CreditType,
			source: r.source as TransactionSource,
			createdAt: r.createdAt as ISODateString
		})),
		pagination,
		filters: { search, creditType: creditType ?? '', source: source ?? '', from, to }
	} satisfies StaffCreditsResponse);
};
