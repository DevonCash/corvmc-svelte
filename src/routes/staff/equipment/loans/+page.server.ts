import { listLoans } from '$lib/server/equipment/loan-service';
import type { LoanStatus } from '$lib/server/equipment/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const search = url.searchParams.get('q')?.trim() ?? '';
	const status = (url.searchParams.get('status') || undefined) as LoanStatus | undefined;

	const loans = await listLoans({
		search: search || undefined,
		status
	});

	return {
		loans: loans.map((l) => ({
			...l,
			requestedPickupDate: l.requestedPickupDate.toISOString(),
			scheduledPickupDate: l.scheduledPickupDate?.toISOString() ?? null,
			dueDate: l.dueDate?.toISOString() ?? null,
			checkedOutAt: l.checkedOutAt?.toISOString() ?? null,
			returnedAt: l.returnedAt?.toISOString() ?? null,
			createdAt: l.createdAt.toISOString(),
			updatedAt: l.updatedAt.toISOString()
		})),
		filters: { search, status: status ?? '' }
	};
};
