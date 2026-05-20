import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { addCredits, deductCredits } from '$lib/server/finance/credit-service';
import type { CreditType } from '$lib/server/db/schema/finance';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	await requireStaffRole(locals.user?.id);

	const body = (await request.json()) as {
		creditType?: string;
		amount?: number;
		description?: string;
	};

	if (!body.creditType || body.amount === undefined || !body.description) {
		throw error(400, 'Missing required fields');
	}
	if (body.creditType !== 'free_hours' && body.creditType !== 'equipment_credits') {
		throw error(400, 'Invalid credit type');
	}
	if (body.amount === 0) throw error(400, 'Amount cannot be zero');

	const type = body.creditType as CreditType;

	if (body.amount > 0) {
		await addCredits(params.id, type, body.amount, 'admin_adjustment', undefined, body.description);
	} else {
		await deductCredits(params.id, type, Math.abs(body.amount), 'admin_adjustment', undefined, body.description);
	}

	return json({ success: true });
};
