import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { cancel } from '$lib/server/reservation/reservation-service';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) return json({ error: 'Not authenticated' }, { status: 401 });

	const formData = await request.formData();
	const reservationId = formData.get('reservationId') as string;
	const reason = (formData.get('reason') as string) || undefined;

	if (!reservationId) return json({ error: 'Missing reservation ID' }, { status: 400 });

	try {
		await cancel(reservationId, locals.user.id, reason);
		return json({ success: true });
	} catch (err) {
		return json({ error: (err as Error).message }, { status: 400 });
	}
};
