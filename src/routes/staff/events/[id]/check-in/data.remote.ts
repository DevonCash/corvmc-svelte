import { z } from 'zod';
import { command } from '$app/server';
import { requireStaff } from '$lib/server/authorization';
import { checkIn } from '$lib/server/ticket/ticket-service';

export const checkInTicket = command(
	z.object({ ticketId: z.string().min(1) }),
	async (data) => {
		const staff = await requireStaff();
		await checkIn(data.ticketId, staff.id);
		return { success: true };
	}
);
