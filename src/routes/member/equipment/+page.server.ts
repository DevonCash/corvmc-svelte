import { redirect } from '@sveltejs/kit';
import { listEquipment, listCategories } from '$lib/server/equipment/equipment-service';
import { getBalance } from '$lib/server/finance/credit-service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) return redirect(302, '/demo/better-auth/login');

	const categoryId = url.searchParams.get('category') || undefined;
	const search = url.searchParams.get('q')?.trim() ?? '';

	const [equipmentList, categories, creditBalance] = await Promise.all([
		listEquipment({ search: search || undefined, categoryId, status: 'available' }),
		listCategories(),
		getBalance(locals.user.id, 'equipment_credits')
	]);

	return {
		equipment: equipmentList.map((e) => ({
			id: e.id,
			name: e.name,
			description: e.description,
			categoryId: e.categoryId,
			categoryName: e.category.name,
			pricingTier: e.category.pricingTier,
			condition: e.condition,
			totalQuantity: e.totalQuantity,
			availableQuantity: e.availableQuantity
		})),
		categories: categories.map((c) => ({
			id: c.id,
			name: c.name,
			pricingTier: c.pricingTier
		})),
		creditBalance,
		filters: { search, categoryId: categoryId ?? '' }
	};
};
