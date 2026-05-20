import { z } from 'zod';
import { query, command } from '$app/server';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { like, or } from 'drizzle-orm';
import { requireStaff } from '$lib/server/authorization';
import { getAvailableSlots, getConflictDetails, getValidationWarnings } from '$lib/server/reservation/conflict-service';
import { staffCreate } from '$lib/server/reservation/reservation-service';
import { buildDateInTz } from '$lib/server/reservation/timezone';
import { getReservationConfig } from '$lib/server/reservation/config';
import { getProductConfig } from '$lib/server/finance/product-config-service';

// ---------------------------------------------------------------------------
// Queries — create modal
// ---------------------------------------------------------------------------

export const searchMembers = query(z.string(), async (q) => {
	await requireStaff();
	if (!q || q.length < 2) return [];

	const pattern = `%${q}%`;
	const results = await db
		.select({ id: user.id, name: user.name, email: user.email })
		.from(user)
		.where(or(like(user.name, pattern), like(user.email, pattern)))
		.limit(20);

	return results;
});

export const getSlots = query(z.string(), async (dateParam) => {
	await requireStaff();
	const date = dateParam ? new Date(dateParam + 'T00:00:00') : new Date();
	const [slots, rehearsalConfig, reservationConfig] = await Promise.all([
		getAvailableSlots(date),
		getProductConfig('rehearsal'),
		getReservationConfig()
	]);

	return {
		date: date.toISOString().split('T')[0],
		slots,
		config: {
			hourlyRateCents: rehearsalConfig.unitAmountCents,
			slotMinutes: reservationConfig.timeSlotMinutes,
			minDurationHours: reservationConfig.minDurationHours,
			maxDurationHours: reservationConfig.maxDurationHours
		}
	};
});

export const checkConflicts = query(
	z.object({ date: z.string(), startTime: z.string(), endTime: z.string() }),
	async ({ date, startTime, endTime }) => {
		await requireStaff();
		const startsAt = buildDateInTz(date, startTime, 'America/Los_Angeles');
		const endsAt = buildDateInTz(date, endTime, 'America/Los_Angeles');

		const conflicts = await getConflictDetails(startsAt, endsAt);
		const validationWarnings = await getValidationWarnings(startsAt, endsAt);

		return { conflicts, validationWarnings };
	}
);

// ---------------------------------------------------------------------------
// Forms — create modal
// ---------------------------------------------------------------------------

const staffCreateSchema = z.object({
	memberId: z.string().min(1, 'Select a member'),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
	startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time'),
	endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time'),
	notes: z.string().optional()
});

export const createReservation = command(staffCreateSchema, async (raw) => {
	await requireStaff();
	const data = raw as z.infer<typeof staffCreateSchema>;
	const startsAt = buildDateInTz(data.date, data.startTime, 'America/Los_Angeles');
	const endsAt = buildDateInTz(data.date, data.endTime, 'America/Los_Angeles');

	const res = await staffCreate({
		userId: data.memberId,
		bookerType: 'user',
		bookerId: data.memberId,
		startsAt,
		endsAt,
		notes: data.notes,
		status: 'confirmed'
	});

	return { reservationId: res.id };
});


