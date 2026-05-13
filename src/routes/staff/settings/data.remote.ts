import { z } from 'zod';
import { query, form, getRequestEvent } from '$app/server';
import {
	getAllProductConfigs,
	updateProductConfig,
	type ProductKey
} from '$lib/server/finance/product-config-service';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getProducts = query(async () => {
	return getAllProductConfigs();
});

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

const updateProductSchema = z.object({
	key: z.enum(['contribution', 'rehearsal', 'fee_coverage']),
	name: z.string().trim().min(1, 'Name is required'),
	description: z.string().trim(),
	unitAmountCents: z.string().regex(/^\d+$/, 'Amount must be a whole number of cents')
});

export const updateProduct = form(updateProductSchema, async (raw) => {
	const data = raw as z.infer<typeof updateProductSchema>;

	await updateProductConfig(data.key as ProductKey, {
		name: data.name,
		description: data.description || null,
		unitAmountCents: parseInt(data.unitAmountCents, 10)
	});

	// Refresh the products query
	void getProducts().refresh();

	return { success: true };
});
