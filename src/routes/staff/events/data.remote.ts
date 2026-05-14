import { z } from 'zod';
import { command, query } from '$app/server';
import { requireStaff } from '$lib/server/authorization';
import { create } from '$lib/server/event/event-service';
import { getConflictDetails, getValidationWarnings } from '$lib/server/reservation/conflict-service';
import { buildDateInTz } from '$lib/server/reservation/timezone';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const checkConflicts = query(
	z.object({ date: z.string(), startTime: z.string(), endTime: z.string() }),
	async ({ date, startTime, endTime }) => {
		await requireStaff();
		const startsAt = buildDateInTz(date, startTime, 'America/Los_Angeles');
		const endsAt = buildDateInTz(date, endTime, 'America/Los_Angeles');

		const conflicts = await getConflictDetails(startsAt, endsAt);
		const validationWarnings = getValidationWarnings(startsAt, endsAt);

		return { conflicts, validationWarnings };
	}
);

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const createEventSchema = z.object({
	title: z.string().min(1, 'Title is required'),
	description: z.string().optional(),
	eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
	eventStartTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time'),
	eventEndTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time'),
	doorsTime: z.string().optional(),
	tags: z.string().optional(),
	reserveSpace: z.boolean(),
	reservationStartTime: z.string().optional(),
	reservationEndTime: z.string().optional(),
	overrideConflicts: z.boolean().default(false)
});

export const createEvent = command(createEventSchema, async (raw) => {
	const staff = await requireStaff();
	const data = raw as z.infer<typeof createEventSchema>;

	const tz = 'America/Los_Angeles';
	const startsAt = buildDateInTz(data.eventDate, data.eventStartTime, tz);
	const endsAt = buildDateInTz(data.eventDate, data.eventEndTime, tz);
	const doorsAt = data.doorsTime ? buildDateInTz(data.eventDate, data.doorsTime, tz) : undefined;

	const reservation = data.reserveSpace && data.reservationStartTime && data.reservationEndTime
		? {
				startsAt: buildDateInTz(data.eventDate, data.reservationStartTime, tz),
				endsAt: buildDateInTz(data.eventDate, data.reservationEndTime, tz),
				overrideConflicts: data.overrideConflicts
			}
		: undefined;

	const event = await create({
		title: data.title,
		description: data.description,
		startsAt,
		endsAt,
		doorsAt,
		tags: data.tags,
		createdByUserId: staff.id,
		reservation
	});

	return { eventId: event.id };
});
