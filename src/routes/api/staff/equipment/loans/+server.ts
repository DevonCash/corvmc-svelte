import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAnyRole } from '$lib/server/authorization';
import { listLoans } from '$lib/server/equipment/loan-service';
import { parsePagination } from '$lib/server/db/paginate';
import type { LoanStatus } from '$lib/server/db/schema/equipment';
import { toISO } from '$lib/server/db/schema/columns';
import type { StaffEquipmentLoansResponse } from '$lib/server/db/schema/api';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Staff access required');

	const search = url.searchParams.get('q')?.trim() ?? '';
	const status = (url.searchParams.get('status') || undefined) as LoanStatus | undefined;

	const { rows, pagination } = await listLoans(
		{ search: search || undefined, status },
		parsePagination(url)
	);

	return json({
		loans: rows.map((l) => ({
			id: l.id,
			status: l.status,
			requestedPickupDate: toISO(l.requestedPickupDate),
			scheduledPickupDate: l.scheduledPickupDate ? toISO(l.scheduledPickupDate) : null,
			dueDate: l.dueDate ? toISO(l.dueDate) : null,
			checkedOutAt: l.checkedOutAt ? toISO(l.checkedOutAt) : null,
			returnedAt: l.returnedAt ? toISO(l.returnedAt) : null,
			createdAt: toISO(l.createdAt),
			updatedAt: toISO(l.updatedAt)
		})),
		pagination,
		filters: { search, status: status ?? '' }
	} satisfies StaffEquipmentLoansResponse);
};
