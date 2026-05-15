import { listEquipment, listCategories } from '$lib/server/equipment/equipment-service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const search = url.searchParams.get('q')?.trim() ?? '';
	const categoryId = url.searchParams.get('category') || undefined;
	const status = url.searchParams.get('status') || undefined;

	const [equipmentList, categories] = await Promise.all([
		listEquipment({ search: search || undefined, categoryId, status }),
		listCategories()
	]);

	return {
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
		filters: { search, categoryId: categoryId ?? '', status: status ?? '' }
	};
};
