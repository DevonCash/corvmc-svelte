import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { user } from '$lib/server/db/schema/auth';
import { and, eq, isNull, isNotNull, gte, lt } from 'drizzle-orm';
import { createTemporaryUser, removeTemporaryUser } from './ultraloc-client';

// ---------------------------------------------------------------------------
// LockService — provision and clean up Ultraloc temporary users
// ---------------------------------------------------------------------------

/**
 * Run the daily lock job: clean up yesterday's access, then provision today's.
 */
export async function runDailyLockJob(): Promise<{ provisioned: number; cleaned: number; errors: string[] }> {
	const errors: string[] = [];

	const cleaned = await cleanupPreviousDayAccess(errors);
	const provisioned = await provisionDailyAccess(errors);

	return { provisioned, cleaned, errors };
}

/**
 * Create Ultraloc temporary users for all confirmed reservations today
 * that don't already have lock access.
 */
async function provisionDailyAccess(errors: string[]): Promise<number> {
	const tz = 'America/Los_Angeles';
	const now = new Date();
	const todayStr = now.toLocaleDateString('en-CA', { timeZone: tz });

	// Day boundaries in UTC
	const dayStart = buildDateInTz(todayStr, '00:00', tz);
	const dayEnd = buildDateInTz(todayStr, '23:59', tz);

	const rows = await db
		.select({
			id: reservation.id,
			startsAt: reservation.startsAt,
			endsAt: reservation.endsAt,
			createdByUserId: reservation.createdByUserId,
			memberName: user.name
		})
		.from(reservation)
		.innerJoin(user, eq(reservation.createdByUserId, user.id))
		.where(
			and(
				eq(reservation.status, 'confirmed'),
				isNull(reservation.lockAccessId),
				gte(reservation.startsAt, dayStart),
				lt(reservation.startsAt, dayEnd)
			)
		);

	let count = 0;

	for (const row of rows) {
		try {
			const tempUserId = await createTemporaryUser({
				name: row.memberName,
				startTime: row.startsAt,
				endTime: row.endsAt
			});

			await db
				.update(reservation)
				.set({ lockAccessId: tempUserId, updatedAt: new Date() })
				.where(eq(reservation.id, row.id));

			count++;
		} catch (err) {
			const msg = `Failed to provision lock access for reservation ${row.id}: ${(err as Error).message}`;
			console.error(msg);
			errors.push(msg);
		}
	}

	return count;
}

/**
 * Remove Ultraloc temporary users for all reservations from yesterday
 * that still have a lockAccessId.
 */
async function cleanupPreviousDayAccess(errors: string[]): Promise<number> {
	const tz = 'America/Los_Angeles';
	const now = new Date();

	// Yesterday's boundaries
	const yesterday = new Date(now);
	yesterday.setDate(yesterday.getDate() - 1);
	const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: tz });

	const dayStart = buildDateInTz(yesterdayStr, '00:00', tz);
	const dayEnd = buildDateInTz(yesterdayStr, '23:59', tz);

	const rows = await db
		.select({
			id: reservation.id,
			lockAccessId: reservation.lockAccessId
		})
		.from(reservation)
		.where(
			and(
				isNotNull(reservation.lockAccessId),
				gte(reservation.startsAt, dayStart),
				lt(reservation.startsAt, dayEnd)
			)
		);

	let count = 0;

	for (const row of rows) {
		try {
			await removeTemporaryUser(row.lockAccessId!);

			await db
				.update(reservation)
				.set({ lockAccessId: null, updatedAt: new Date() })
				.where(eq(reservation.id, row.id));

			count++;
		} catch (err) {
			const msg = `Failed to cleanup lock access for reservation ${row.id}: ${(err as Error).message}`;
			console.error(msg);
			errors.push(msg);
		}
	}

	return count;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDateInTz(dateStr: string, timeStr: string, tz: string): Date {
	const [hours, minutes] = timeStr.split(':').map(Number);
	const utcDate = new Date(`${dateStr}T${timeStr}:00Z`);

	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone: tz,
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});

	const parts = formatter.formatToParts(utcDate);
	const localHour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
	const localMinute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);

	const wantedMinutes = hours * 60 + minutes;
	const gotMinutes = localHour * 60 + localMinute;
	const offsetMinutes = gotMinutes - wantedMinutes;

	return new Date(utcDate.getTime() - offsetMinutes * 60 * 1000);
}
