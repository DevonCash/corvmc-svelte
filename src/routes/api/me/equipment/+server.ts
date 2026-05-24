import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listEquipment, listCategories } from '$lib/server/equipment/equipment-service';
import { getBalance } from '$lib/server/finance/credit-service';
import { getSubscription } from '$lib/server/finance/subscription-service';
import type { MemberEquipmentResponse } from '$lib/server/db/schema/api';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return error(401, 'Not authenticated');

	const categoryId = url.searchParams.get('category') || undefined;
	const search = url.searchParams.get('q')?.trim() ?? '';

	const [{ rows: equipmentList }, categories, creditBalance] = await Promise.all([
		listEquipment({ search: search || undefined, categoryId, status: 'available' }),
		listCategories(),
		getBalance(locals.user.id, 'equipment_credits')
	]);

	let isSustainingMember = false;
	if (locals.user.stripeId) {
		const sub = await getSubscription(locals.user.stripeId);
		isSustainingMember = sub !== null;
	}

	return json({
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
		isSustainingMember,
		filters: { search, categoryId: categoryId ?? '' }
	} satisfies MemberEquipmentResponse);
};
