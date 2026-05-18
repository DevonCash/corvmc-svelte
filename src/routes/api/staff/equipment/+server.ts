import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAnyRole } from '$lib/server/authorization';
import { listEquipment, listCategories } from '$lib/server/equipment/equipment-service';
import { parsePagination } from '$lib/server/db/paginate';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Staff access required');

	const search = url.searchParams.get('q')?.trim() ?? '';
	const categoryId = url.searchParams.get('category') || undefined;
	const status = url.searchParams.get('status') || undefined;

	const [{ rows: equipmentList, pagination }, categories] = await Promise.all([
		listEquipment({ search: search || undefined, categoryId, status }, parsePagination(url)),
		listCategories()
	]);

	return json({
		equipment: equipmentList.map((e) => ({
			...e,
			createdAt: e.createdAt.toISOString(),
			updatedAt: e.updatedAt.toISOString(),
			deletedAt: e.deletedAt?.toISOString() ?? null,
			category: {
				...e.category,
				createdAt: e.category.createdAt.toISOString(),
				updatedAt: e.category.updatedAt.toISOString()
			}
		})),
		categories: categories.map((c) => ({
			...c,
			createdAt: c.createdAt.toISOString(),
			updatedAt: c.updatedAt.toISOString()
		})),
		pagination,
		filters: { search, categoryId: categoryId ?? '', status: status ?? '' }
	});
};
