import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { createTickets, getTicketsRemaining } from '$lib/server/ticket/ticket-service';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	await requireStaffRole(locals.user?.id);

	const body = (await request.json()) as {
		attendeeName?: string;
		attendeeEmail?: string;
		quantity?: number;
	};

	if (!body.attendeeName || !body.attendeeEmail || !body.quantity) {
		throw error(400, 'Missing required fields');
	}
	if (body.quantity < 1 || body.quantity > 50) {
		throw error(400, 'Quantity must be between 1 and 50');
	}

	const remaining = await getTicketsRemaining(params.id);
	if (remaining !== null && body.quantity > remaining) {
		throw error(400, `Only ${remaining} ticket(s) remaining`);
	}

	await createTickets({
		eventId: params.id,
		purchaseId: `comp-${crypto.randomUUID()}`,
		quantity: body.quantity,
		attendeeName: body.attendeeName,
		attendeeEmail: body.attendeeEmail,
		status: 'valid'
	});

	return json({ success: true });
};
