import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAnyRole } from '$lib/server/authorization';
import { listEquipment, listCategories } from '$lib/server/equipment/equipment-service';
import { parsePagination } from '$lib/server/db/paginate';
import { equipmentStatuses } from '$lib/config';
import type { StaffEquipmentResponse } from '$lib/server/db/schema/api';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Staff access required');

	const search = url.searchParams.get('q')?.trim() ?? '';
	const categoryId = url.searchParams.get('category') || undefined;
	const statusParam = url.searchParams.get('status') || '';
	const status = (equipmentStatuses as readonly string[]).includes(statusParam)
		? (statusParam as (typeof equipmentStatuses)[number])
		: undefined;

	const [{ rows: equipmentList, pagination }, categories] = await Promise.all([
		listEquipment({ search: search || undefined, categoryId, status }, parsePagination(url)),
		listCategories()
	]);

	return json({
		equipment: equipmentList.map((e) => ({
			id: e.id,
			name: e.name,
			description: e.description,
			categoryId: e.categoryId,
			createdAt: toISO(e.createdAt),
			updatedAt: toISO(e.updatedAt),
			deletedAt: e.deletedAt ? toISO(e.deletedAt) : null,
			category: {
				id: e.category.id,
				name: e.category.name,
				pricingTier: e.category.pricingTier,
				createdAt: toISO(e.category.createdAt),
				updatedAt: toISO(e.category.updatedAt)
			}
		})),
		categories: categories.map((c) => ({
			id: c.id,
			name: c.name,
			pricingTier: c.pricingTier,
			displayOrder: c.displayOrder,
			createdAt: c.createdAt,
			updatedAt: c.updatedAt
		})),
		pagination,
		filters: { search, categoryId: categoryId ?? '', status: status ?? '' }
	});
};
