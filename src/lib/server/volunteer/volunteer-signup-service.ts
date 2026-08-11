import { db } from '$lib/server/db';
import {
	volunteerShift,
	volunteerSignup,
	volunteerRole,
	volunteerShiftFeedback
} from '$lib/server/db/schema/volunteer';
import { user } from '$lib/server/db/schema/authentication';
import { and, asc, eq, inArray, isNull, lt, ne, sql } from 'drizzle-orm';
import { DomainError } from '$lib/server/errors';
import { primaryRoleFor } from '$lib/server/authorization';
import { countActiveSignups, getShiftById } from './volunteer-shift-service';
import { missingRequirements } from './member-certification-service';
import type { VolunteerSignup } from '$lib/server/db/schema/volunteer';
import type { VolunteerSignupStatus } from '$lib/config';

// ---------------------------------------------------------------------------
// Signups
// ---------------------------------------------------------------------------
// One member on one shift. Claiming is the only member-initiated write; staff
// confirm, mark no-shows, and the completion sweep runs from a cron.
// ---------------------------------------------------------------------------

export class SignupNotFoundError extends DomainError {
	readonly httpStatus = 404;
	constructor() {
		super('Signup not found');
	}
}

export class ShiftFullError extends DomainError {
	readonly httpStatus = 409;
	constructor() {
		super('Somebody just took the last place on this shift.');
	}
}

export class ShiftClosedError extends DomainError {
	readonly httpStatus = 409;
	constructor(reason: string) {
		super(reason);
	}
}

export class NotClearedError extends DomainError {
	readonly httpStatus = 403;
	constructor(missing: { name: string }[]) {
		super(
			`This role needs ${missing.map((m) => m.name).join(' and ')} before you can work it alone. ` +
				`Talk to staff about getting cleared — you can still log hours for work you've already done.`
		);
	}
}

// ---------------------------------------------------------------------------
// Member actions
// ---------------------------------------------------------------------------

/**
 * Put your hand up for a shift.
 *
 * Three guards, in the order that gives the most useful message: the shift is
 * still open, you're cleared for it, and there's room. The unique index on
 * (shiftId, userId) is the backstop for two requests passing the capacity check
 * at once — no transaction, per the lint rule, so the constraint does the
 * arbitration.
 */
export async function claimShift(shiftId: string, userId: string): Promise<VolunteerSignup> {
	const shift = await getShiftById(shiftId);
	if (!shift) throw new SignupNotFoundError();
	if (shift.cancelledAt) throw new ShiftClosedError('That shift was called off.');
	if (shift.endsAt < new Date()) throw new ShiftClosedError('That shift has already happened.');

	// Clearance is checked against the shift's date, not today: a card that
	// lapses next week doesn't cover a shift the week after.
	const missing = await missingRequirements(userId, shift.volunteerRoleId, shift.startsAt);
	if (missing.length > 0) throw new NotClearedError(missing);

	const [existing] = await db
		.select({ id: volunteerSignup.id, status: volunteerSignup.status })
		.from(volunteerSignup)
		.where(and(eq(volunteerSignup.shiftId, shiftId), eq(volunteerSignup.userId, userId)))
		.limit(1);

	// Re-claiming after cancelling is ordinary — people change their minds — so
	// that reuses the row rather than tripping the unique index.
	if (existing) {
		if (existing.status !== 'cancelled') return reloadSignup(existing.id);

		if ((await countActiveSignups(shiftId)) >= shift.capacity) throw new ShiftFullError();

		const [row] = await db
			.update(volunteerSignup)
			.set({
				status: 'claimed',
				claimedAt: new Date(),
				cancelledAt: null,
				updatedAt: new Date()
			})
			.where(eq(volunteerSignup.id, existing.id))
			.returning();
		return row;
	}

	if ((await countActiveSignups(shiftId)) >= shift.capacity) throw new ShiftFullError();

	try {
		const [row] = await db
			.insert(volunteerSignup)
			.values({ shiftId, userId, status: 'claimed' })
			.returning();
		return row;
	} catch (err) {
		// The unique index fired — two clicks, or two tabs.
		if (err instanceof Error && /UNIQUE constraint failed/i.test(err.message)) {
			const [row] = await db
				.select()
				.from(volunteerSignup)
				.where(and(eq(volunteerSignup.shiftId, shiftId), eq(volunteerSignup.userId, userId)))
				.limit(1);
			if (row) return row;
		}
		throw err;
	}
}

/** Drop out. Frees the place immediately. */
export async function cancelSignup(signupId: string, userId: string): Promise<VolunteerSignup> {
	const [row] = await db
		.update(volunteerSignup)
		.set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
		.where(
			and(
				eq(volunteerSignup.id, signupId),
				eq(volunteerSignup.userId, userId),
				inArray(volunteerSignup.status, ['claimed', 'confirmed'])
			)
		)
		.returning();

	if (!row) throw new SignupNotFoundError();
	return row;
}

// ---------------------------------------------------------------------------
// Staff actions
// ---------------------------------------------------------------------------

export async function confirmSignup(signupId: string): Promise<VolunteerSignup> {
	const [row] = await db
		.update(volunteerSignup)
		.set({ status: 'confirmed', confirmedAt: new Date(), updatedAt: new Date() })
		.where(and(eq(volunteerSignup.id, signupId), eq(volunteerSignup.status, 'claimed')))
		.returning();

	if (!row) throw new SignupNotFoundError();
	return row;
}

/**
 * Nobody turned up. Distinct from cancelled — a cancellation is notice, a
 * no-show is not, and only one of them is worth knowing about next time.
 */
export async function markNoShow(signupId: string): Promise<VolunteerSignup> {
	const [row] = await db
		.update(volunteerSignup)
		.set({ status: 'no_show', updatedAt: new Date() })
		.where(
			and(
				eq(volunteerSignup.id, signupId),
				inArray(volunteerSignup.status, ['claimed', 'confirmed', 'completed'])
			)
		)
		.returning();

	if (!row) throw new SignupNotFoundError();
	return row;
}

// ---------------------------------------------------------------------------
// The completion sweep
// ---------------------------------------------------------------------------

export interface CompletedSignup {
	signupId: string;
	userId: string;
	userName: string;
	userEmail: string;
	shiftId: string;
	roleName: string;
	startsAt: Date;
	endsAt: Date;
}

/**
 * Move confirmed signups past their shift's end to `completed`.
 *
 * Only `confirmed` — a claim staff never confirmed is not evidence anyone
 * worked, and silently completing it would put hours in front of a member they
 * never agreed to do.
 */
export async function completeFinishedShifts(now = new Date()): Promise<CompletedSignup[]> {
	const due = await db
		.select({
			signupId: volunteerSignup.id,
			userId: volunteerSignup.userId,
			userName: user.name,
			userEmail: user.email,
			shiftId: volunteerShift.id,
			roleName: volunteerRole.name,
			startsAt: volunteerShift.startsAt,
			endsAt: volunteerShift.endsAt
		})
		.from(volunteerSignup)
		.innerJoin(volunteerShift, eq(volunteerShift.id, volunteerSignup.shiftId))
		.innerJoin(volunteerRole, eq(volunteerRole.id, volunteerShift.volunteerRoleId))
		.innerJoin(user, eq(user.id, volunteerSignup.userId))
		.where(
			and(
				eq(volunteerSignup.status, 'confirmed'),
				lt(volunteerShift.endsAt, now),
				isNull(volunteerShift.cancelledAt)
			)
		);

	if (due.length === 0) return [];

	await db
		.update(volunteerSignup)
		.set({ status: 'completed', completedAt: now, updatedAt: now })
		.where(
			inArray(
				volunteerSignup.id,
				due.map((d) => d.signupId)
			)
		);

	return due;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

async function reloadSignup(id: string): Promise<VolunteerSignup> {
	const [row] = await db.select().from(volunteerSignup).where(eq(volunteerSignup.id, id)).limit(1);
	if (!row) throw new SignupNotFoundError();
	return row;
}

export interface ShiftClaimant {
	signupId: string;
	userId: string;
	name: string;
	email: string;
	pronouns: string | null;
	role: string | null;
	status: VolunteerSignupStatus;
	claimedAt: Date;
}

export async function listClaimants(shiftId: string): Promise<ShiftClaimant[]> {
	const rows = await db
		.select({
			signupId: volunteerSignup.id,
			userId: volunteerSignup.userId,
			name: user.name,
			email: user.email,
			pronouns: user.pronouns,
			role: primaryRoleFor(user.id),
			status: volunteerSignup.status,
			claimedAt: volunteerSignup.claimedAt
		})
		.from(volunteerSignup)
		.innerJoin(user, eq(user.id, volunteerSignup.userId))
		.where(and(eq(volunteerSignup.shiftId, shiftId), ne(volunteerSignup.status, 'cancelled')))
		.orderBy(asc(volunteerSignup.claimedAt));

	return rows;
}

/** Confirmed signups for shifts starting inside a window — the reminder cron. */
export async function listSignupsStartingBetween(from: Date, to: Date): Promise<CompletedSignup[]> {
	return db
		.select({
			signupId: volunteerSignup.id,
			userId: volunteerSignup.userId,
			userName: user.name,
			userEmail: user.email,
			shiftId: volunteerShift.id,
			roleName: volunteerRole.name,
			startsAt: volunteerShift.startsAt,
			endsAt: volunteerShift.endsAt
		})
		.from(volunteerSignup)
		.innerJoin(volunteerShift, eq(volunteerShift.id, volunteerSignup.shiftId))
		.innerJoin(volunteerRole, eq(volunteerRole.id, volunteerShift.volunteerRoleId))
		.innerJoin(user, eq(user.id, volunteerSignup.userId))
		.where(
			and(
				eq(volunteerSignup.status, 'confirmed'),
				isNull(volunteerShift.cancelledAt),
				sql`${volunteerShift.startsAt} >= ${Math.floor(from.getTime() / 1000)}`,
				sql`${volunteerShift.startsAt} < ${Math.floor(to.getTime() / 1000)}`
			)
		);
}

/** A member's completed shifts with no hour log yet — the pre-fill offer. */
export async function listUnloggedCompletions(userId: string) {
	return db
		.select({
			signupId: volunteerSignup.id,
			shiftId: volunteerShift.id,
			volunteerRoleId: volunteerShift.volunteerRoleId,
			roleName: volunteerRole.name,
			startsAt: volunteerShift.startsAt,
			endsAt: volunteerShift.endsAt
		})
		.from(volunteerSignup)
		.innerJoin(volunteerShift, eq(volunteerShift.id, volunteerSignup.shiftId))
		.innerJoin(volunteerRole, eq(volunteerRole.id, volunteerShift.volunteerRoleId))
		.where(
			and(
				eq(volunteerSignup.userId, userId),
				eq(volunteerSignup.status, 'completed'),
				sql`not exists (
					select 1 from "volunteer_hour_log" vhl
					where vhl."shift_id" = ${volunteerShift.id} and vhl."user_id" = ${userId}
				)`
			)
		)
		.orderBy(asc(volunteerShift.startsAt));
}

/**
 * Completed signups whose shift ended inside a window and that haven't been
 * asked for feedback yet — the day-after survey.
 *
 * The "no feedback row" clause is what makes the cron idempotent: a second run
 * over the same window finds nothing, so a retry can't double-ask. Asking is
 * recorded by the answer, not by a sent-flag, which means somebody who never
 * answers is asked once and then left alone.
 */
export async function listCompletionsAwaitingFeedback(
	from: Date,
	to: Date
): Promise<CompletedSignup[]> {
	return db
		.select({
			signupId: volunteerSignup.id,
			userId: volunteerSignup.userId,
			userName: user.name,
			userEmail: user.email,
			shiftId: volunteerShift.id,
			roleName: volunteerRole.name,
			startsAt: volunteerShift.startsAt,
			endsAt: volunteerShift.endsAt
		})
		.from(volunteerSignup)
		.innerJoin(volunteerShift, eq(volunteerShift.id, volunteerSignup.shiftId))
		.innerJoin(volunteerRole, eq(volunteerRole.id, volunteerShift.volunteerRoleId))
		.innerJoin(user, eq(user.id, volunteerSignup.userId))
		.leftJoin(volunteerShiftFeedback, eq(volunteerShiftFeedback.signupId, volunteerSignup.id))
		.where(
			and(
				eq(volunteerSignup.status, 'completed'),
				isNull(volunteerShiftFeedback.id),
				sql`${volunteerShift.endsAt} >= ${Math.floor(from.getTime() / 1000)}`,
				sql`${volunteerShift.endsAt} < ${Math.floor(to.getTime() / 1000)}`
			)
		);
}
