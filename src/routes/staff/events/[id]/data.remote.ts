import { z } from 'zod';
import { command } from '$app/server';
import { requireStaff } from '$lib/server/authorization';
import { publish, cancel, update } from '$lib/server/event/event-service';

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export const publishEvent = command(
	z.object({ eventId: z.string().min(1) }),
	async (data) => {
		await requireStaff();
		await publish(data.eventId);
		return { success: true };
	}
);

export const cancelEvent = command(
	z.object({ eventId: z.string().min(1) }),
	async (data) => {
		const staff = await requireStaff();
		await cancel(data.eventId, staff.id);
		return { success: true };
	}
);

const updateEventSchema = z.object({
	eventId: z.string().min(1),
	title: z.string().min(1).optional(),
	description: z.string().nullable().optional(),
	tags: z.string().nullable().optional()
});

export const updateEvent = command(updateEventSchema, async (raw) => {
	await requireStaff();
	const { eventId, ...fields } = raw as z.infer<typeof updateEventSchema>;
	await update(eventId, fields);
	return { success: true };
});
