import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { user } from '$lib/server/db/schema/authentication';
import { and, eq, isNull, isNotNull, gte, lt } from 'drizzle-orm';
import { buildDateInTz } from '$lib/server/reservation/timezone';
import {
	createTemporaryUser,
	removeTemporaryUser,
	listLockUsers,
	generateLockCode
} from './ultraloc-client';
import { DEFAULT_TIMEZONE } from '$lib/config';

// ---------------------------------------------------------------------------
// LockService — provision and clean up Ultraloc temporary users
// ---------------------------------------------------------------------------

/**
 * Run the daily lock job: clean up yesterday's access, then provision today's.
 */
export async function runDailyLockJob(): Promise<{
	provisioned: number;
	cleaned: number;
	errors: string[];
}> {
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
	const tz = DEFAULT_TIMEZONE;
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
				isNull(reservation.lockCode),
				gte(reservation.startsAt, dayStart),
				lt(reservation.startsAt, dayEnd)
			)
		);

	let count = 0;

	for (const row of rows) {
		try {
			const code = generateLockCode();

			await createTemporaryUser({
				name: row.memberName,
				startTime: row.startsAt,
				endTime: row.endsAt,
				code
			});

			await db
				.update(reservation)
				.set({ lockCode: String(code), updatedAt: new Date() })
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
 * Remove expired temporary lock users and clear stale door codes.
 *
 * The lock enforces access via each temporary user's daterange, so we delete
 * any temporary user (type 2) whose window has fully passed, then null out the
 * door code on yesterday's reservations for DB hygiene. The two steps are
 * independent — a failure in one does not block the other.
 */
async function cleanupPreviousDayAccess(errors: string[]): Promise<number> {
	const tz = DEFAULT_TIMEZONE;
	const now = new Date();

	let count = 0;

	// --- Lock side: delete expired temporary users ---------------------------
	try {
		const users = await listLockUsers();

		for (const u of users) {
			if (u.type !== 2 || !u.daterange) continue;

			const [datePart, timePart] = u.daterange[1].split(' ');
			const end = buildDateInTz(datePart, timePart, tz);
			if (end >= now) continue;

			try {
				await removeTemporaryUser(u.id);
				count++;
			} catch (err) {
				const msg = `Failed to remove expired lock user ${u.id}: ${(err as Error).message}`;
				console.error(msg);
				errors.push(msg);
			}
		}
	} catch (err) {
		const msg = `Failed to list lock users for cleanup: ${(err as Error).message}`;
		console.error(msg);
		errors.push(msg);
	}

	// --- DB hygiene: clear codes on yesterday's reservations -----------------
	try {
		const yesterday = new Date(now);
		yesterday.setDate(yesterday.getDate() - 1);
		const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: tz });

		const dayStart = buildDateInTz(yesterdayStr, '00:00', tz);
		const dayEnd = buildDateInTz(yesterdayStr, '23:59', tz);

		await db
			.update(reservation)
			.set({ lockCode: null, updatedAt: new Date() })
			.where(
				and(
					isNotNull(reservation.lockCode),
					gte(reservation.startsAt, dayStart),
					lt(reservation.startsAt, dayEnd)
				)
			);
	} catch (err) {
		const msg = `Failed to clear stale door codes: ${(err as Error).message}`;
		console.error(msg);
		errors.push(msg);
	}

	return count;
}
