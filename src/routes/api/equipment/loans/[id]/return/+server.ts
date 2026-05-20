import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { returnLoan } from '$lib/server/equipment/loan-service';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	await requireStaffRole(locals.user?.id);
	const body = (await request.json().catch(() => ({}))) as { staffNotes?: string };
	await returnLoan(params.id, body.staffNotes);
	return json({ success: true });
};
