import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAnyRole } from '$lib/server/authorization';
import { listLoans } from '$lib/server/equipment/loan-service';
import type { LoanStatus } from '$lib/server/equipment/types';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Staff access required');

	const search = url.searchParams.get('q')?.trim() ?? '';
	const status = (url.searchParams.get('status') || undefined) as LoanStatus | undefined;

	const loans = await listLoans({
		search: search || undefined,
		status
	});

	return json({
		loans: loans.map((l) => ({
			...l,
			requestedPickupDate: l.requestedPickupDate.toISOString(),
			estimatedReturnDate: l.estimatedReturnDate?.toISOString() ?? null,
			scheduledPickupDate: l.scheduledPickupDate?.toISOString() ?? null,
			dueDate: l.dueDate?.toISOString() ?? null,
			checkedOutAt: l.checkedOutAt?.toISOString() ?? null,
			returnedAt: l.returnedAt?.toISOString() ?? null,
			createdAt: l.createdAt.toISOString(),
			updatedAt: l.updatedAt.toISOString()
		})),
		filters: { search, status: status ?? '' }
	});
};
