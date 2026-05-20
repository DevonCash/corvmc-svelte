import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { cancelTicket } from '$lib/server/ticket/ticket-service';

export const POST: RequestHandler = async ({ params, locals }) => {
	await requireStaffRole(locals.user?.id);
	await cancelTicket(params.ticketId);
	return json({ success: true });
};
