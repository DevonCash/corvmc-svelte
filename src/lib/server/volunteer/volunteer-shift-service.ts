import { db } from '$lib/server/db';
import { volunteerShift, volunteerSignup, volunteerRole } from '$lib/server/db/schema/volunteer';
import { event } from '$lib/server/db/schema/event';
import { and, asc, count, eq, gte, inArray, isNull, lte, ne, sql } from 'drizzle-orm';
import { DomainError } from '$lib/server/errors';
import { buildDateInTz } from '$lib/server/reservation/timezone';
import {
	DEFAULT_TIMEZONE,
	VOLUNTEER_SHIFT_MAX_CAPACITY,
	VOLUNTEER_SHIFT_MAX_MINUTES,
	VOLUNTEER_SHIFT_NOTES_MAX
} from '$lib/config';
import type { VolunteerShift, VolunteerRoleGroup } from '$lib/server/db/schema/volunteer';

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------
// A dated, time-bounded need for a role. Staff create them; members claim them.
// No recurrence — a standing weekly slot is made by duplicating last week's.
// ---------------------------------------------------------------------------

const TZ = DEFAULT_TIMEZONE;

export class ShiftNotFoundError extends DomainError {
	readonly httpStatus = 404;
	constructor() {
		super('Shift not found');
	}
}

export class ShiftValidationError extends DomainError {
	readonly httpStatus = 400;
	constructor(message: string) {
		super(message);
	}
}

/** `YYYY-MM-DDTHH:mm` from a datetime-local input, read as club wall-clock time. */
function parseLocal(value: string, label: string): Date {
	const [datePart, timePart] = value.split('T');
	if (!datePart || !timePart)
		throw new ShiftValidationError(`${label} is not a valid date and time`);
	return buildDateInTz(datePart, timePart, TZ);
}

interface ShiftTimes {
	startsAt: Date;
	endsAt: Date;
}

function validateTimes(startsAt: Date, endsAt: Date): ShiftTimes {
	if (endsAt <= startsAt) {
		throw new ShiftValidationError('The shift has to end after it starts.');
	}
	const minutes = (endsAt.getTime() - startsAt.getTime()) / 60_000;
	if (minutes > VOLUNTEER_SHIFT_MAX_MINUTES) {
		throw new ShiftValidationError('That shift is longer than a day — check the end date.');
	}
	return { startsAt, endsAt };
}

function validateCapacity(capacity: number): number {
	if (!Number.isInteger(capacity) || capacity < 1) {
		throw new ShiftValidationError('A shift needs at least one person.');
	}
	if (capacity > VOLUNTEER_SHIFT_MAX_CAPACITY) {
		throw new ShiftValidationError(
			`${VOLUNTEER_SHIFT_MAX_CAPACITY} is the most one shift can ask for.`
		);
	}
	return capacity;
}

function validateNotes(notes?: string | null): string | null {
	const trimmed = notes?.trim() ?? '';
	if (trimmed.length > VOLUNTEER_SHIFT_NOTES_MAX) {
		throw new ShiftValidationError(`Keep the notes under ${VOLUNTEER_SHIFT_NOTES_MAX} characters.`);
	}
	return trimmed || null;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createShift(data: {
	volunteerRoleId: string;
	eventId?: string | null;
	/** `YYYY-MM-DDTHH:mm`, club time. */
	startsAt: string;
	endsAt: string;
	capacity: number;
	notes?: string | null;
	createdByUserId: string;
}): Promise<VolunteerShift> {
	const [role] = await db
		.select({ id: volunteerRole.id, isActive: volunteerRole.isActive })
		.from(volunteerRole)
		.where(eq(volunteerRole.id, data.volunteerRoleId))
		.limit(1);

	if (!role) throw new ShiftValidationError('That role no longer exists.');
	if (!role.isActive) {
		throw new ShiftValidationError('That role is archived — restore it before scheduling shifts.');
	}

	const times = validateTimes(parseLocal(data.startsAt, 'Start'), parseLocal(data.endsAt, 'End'));

	const [row] = await db
		.insert(volunteerShift)
		.values({
			volunteerRoleId: data.volunteerRoleId,
			eventId: data.eventId || null,
			startsAt: times.startsAt,
			endsAt: times.endsAt,
			capacity: validateCapacity(data.capacity),
			notes: validateNotes(data.notes),
			createdByUserId: data.createdByUserId
		})
		.returning();

	return row;
}

/**
 * Copy a shift forward. This is how a standing weekly slot gets made without
 * the table carrying series bookkeeping — the copy is an ordinary shift with
 * no link back, so editing or cancelling one never touches the other.
 */
export async function duplicateShift(
	id: string,
	offsetDays: number,
	createdByUserId: string
): Promise<VolunteerShift> {
	const original = await getShiftById(id);
	if (!original) throw new ShiftNotFoundError();

	if (!Number.isInteger(offsetDays) || offsetDays < 1 || offsetDays > 365) {
		throw new ShiftValidationError('Copy it somewhere between tomorrow and a year out.');
	}

	// Shift the wall-clock date, not the instant: adding 7 × 86,400,000 ms across
	// a DST boundary moves a 6pm shift to 5pm or 7pm.
	const shiftLocalDate = (d: Date) => {
		const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
		const hm = new Intl.DateTimeFormat('en-GB', {
			timeZone: TZ,
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		}).format(d);
		const [y, m, day] = ymd.split('-').map(Number);
		const moved = new Date(Date.UTC(y, m - 1, day + offsetDays));
		return buildDateInTz(moved.toISOString().slice(0, 10), hm, TZ);
	};

	const [row] = await db
		.insert(volunteerShift)
		.values({
			volunteerRoleId: original.volunteerRoleId,
			// Deliberately not copied: the new date is not that event's date.
			eventId: null,
			startsAt: shiftLocalDate(original.startsAt),
			endsAt: shiftLocalDate(original.endsAt),
			capacity: original.capacity,
			notes: original.notes,
			createdByUserId
		})
		.returning();

	return row;
}

export async function updateShift(
	id: string,
	data: {
		volunteerRoleId?: string;
		eventId?: string | null;
		startsAt?: string;
		endsAt?: string;
		capacity?: number;
		notes?: string | null;
	}
): Promise<VolunteerShift> {
	const existing = await getShiftById(id);
	if (!existing) throw new ShiftNotFoundError();

	const startsAt = data.startsAt ? parseLocal(data.startsAt, 'Start') : existing.startsAt;
	const endsAt = data.endsAt ? parseLocal(data.endsAt, 'End') : existing.endsAt;
	validateTimes(startsAt, endsAt);

	// Shrinking below what's already claimed would leave people rostered onto a
	// shift that no longer has room for them.
	if (data.capacity !== undefined) {
		validateCapacity(data.capacity);
		const claimed = await countActiveSignups(id);
		if (data.capacity < claimed) {
			throw new ShiftValidationError(
				`${claimed} ${claimed === 1 ? 'person has' : 'people have'} already claimed this. ` +
					`Cancel a claim before reducing it below ${claimed}.`
			);
		}
	}

	const [row] = await db
		.update(volunteerShift)
		.set({
			...(data.volunteerRoleId ? { volunteerRoleId: data.volunteerRoleId } : {}),
			...(data.eventId !== undefined ? { eventId: data.eventId || null } : {}),
			startsAt,
			endsAt,
			...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
			...(data.notes !== undefined ? { notes: validateNotes(data.notes) } : {}),
			updatedAt: new Date()
		})
		.where(eq(volunteerShift.id, id))
		.returning();

	return row;
}

/**
 * Call off a shift. The row and its signups stay: claimants still need
 * notifying, and "we cancelled that one" is worth being able to see.
 */
export async function cancelShift(id: string): Promise<VolunteerShift> {
	const [row] = await db
		.update(volunteerShift)
		.set({ cancelledAt: new Date(), updatedAt: new Date() })
		.where(and(eq(volunteerShift.id, id), isNull(volunteerShift.cancelledAt)))
		.returning();

	if (!row) throw new ShiftNotFoundError();
	return row;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getShiftById(id: string): Promise<VolunteerShift | null> {
	const [row] = await db.select().from(volunteerShift).where(eq(volunteerShift.id, id)).limit(1);
	return row ?? null;
}

/** Claims that still hold a place — cancelled and no-show ones free their slot. */
const ACTIVE_SIGNUP_STATUSES = ['claimed', 'confirmed', 'completed'] as const;

export async function countActiveSignups(shiftId: string): Promise<number> {
	const [row] = await db
		.select({ n: count() })
		.from(volunteerSignup)
		.where(
			and(
				eq(volunteerSignup.shiftId, shiftId),
				inArray(volunteerSignup.status, [...ACTIVE_SIGNUP_STATUSES])
			)
		);
	return Number(row?.n ?? 0);
}

export interface ShiftWithCounts extends VolunteerShift {
	roleName: string;
	roleGroup: VolunteerRoleGroup;
	eventTitle: string | null;
	claimed: number;
}

function withCounts(
	rows: {
		shift: VolunteerShift;
		roleName: string;
		roleGroup: VolunteerRoleGroup;
		eventTitle: string | null;
		claimed: number;
	}[]
): ShiftWithCounts[] {
	return rows.map((r) => ({
		...r.shift,
		roleName: r.roleName,
		roleGroup: r.roleGroup,
		eventTitle: r.eventTitle,
		claimed: Number(r.claimed)
	}));
}

/**
 * The staff list. Counts only the signups that hold a place, so a cancelled
 * claim reopens the slot rather than leaving the shift looking full.
 */
export async function listShifts(
	filters: {
		volunteerRoleId?: string;
		from?: Date;
		to?: Date;
		includeCancelled?: boolean;
	} = {}
): Promise<ShiftWithCounts[]> {
	const rows = await db
		.select({
			shift: volunteerShift,
			roleName: volunteerRole.name,
			roleGroup: volunteerRole.group,
			eventTitle: event.title,
			claimed: sql<number>`(
				select count(*) from "volunteer_signup" vs
				where vs."shift_id" = ${volunteerShift.id}
					and vs."status" in ('claimed', 'confirmed', 'completed')
			)`
		})
		.from(volunteerShift)
		.innerJoin(volunteerRole, eq(volunteerRole.id, volunteerShift.volunteerRoleId))
		.leftJoin(event, eq(event.id, volunteerShift.eventId))
		.where(
			and(
				filters.includeCancelled ? undefined : isNull(volunteerShift.cancelledAt),
				filters.volunteerRoleId
					? eq(volunteerShift.volunteerRoleId, filters.volunteerRoleId)
					: undefined,
				filters.from ? gte(volunteerShift.startsAt, filters.from) : undefined,
				filters.to ? lte(volunteerShift.startsAt, filters.to) : undefined
			)
		)
		.orderBy(asc(volunteerShift.startsAt));

	return withCounts(rows);
}

export interface OpenShift extends ShiftWithCounts {
	/** This member's own claim, if they have a live one. */
	myStatus: string | null;
	mySignupId: string | null;
	/** Empty when they can claim it. */
	missingCertifications: { id: string; name: string }[];
	isFull: boolean;
	interested: boolean;
}

/**
 * What a member sees. Everything upcoming and live, including shifts they can't
 * take — a shift you're not cleared for is worth seeing precisely because the
 * reason tells you what to go and get. Ordered so roles they've expressed
 * interest in surface first, which is the payoff for the interest table.
 */
export async function listOpenShiftsForMember(
	userId: string,
	opts: { limit?: number } = {}
): Promise<Omit<OpenShift, 'missingCertifications'>[]> {
	const now = new Date();

	const rows = await db
		.select({
			shift: volunteerShift,
			roleName: volunteerRole.name,
			roleGroup: volunteerRole.group,
			eventTitle: event.title,
			claimed: sql<number>`(
				select count(*) from "volunteer_signup" vs
				where vs."shift_id" = ${volunteerShift.id}
					and vs."status" in ('claimed', 'confirmed', 'completed')
			)`,
			myStatus: sql<string | null>`(
				select vs."status" from "volunteer_signup" vs
				where vs."shift_id" = ${volunteerShift.id} and vs."user_id" = ${userId}
					and vs."status" != 'cancelled'
			)`,
			// The id comes back too, so "drop out" has something to post without a
			// second round trip per shift.
			mySignupId: sql<string | null>`(
				select vs."id" from "volunteer_signup" vs
				where vs."shift_id" = ${volunteerShift.id} and vs."user_id" = ${userId}
					and vs."status" != 'cancelled'
			)`,
			interested: sql<number>`(
				select count(*) from "volunteer_role_interest" vri
				where vri."volunteer_role_id" = ${volunteerShift.volunteerRoleId}
					and vri."user_id" = ${userId}
			)`
		})
		.from(volunteerShift)
		.innerJoin(volunteerRole, eq(volunteerRole.id, volunteerShift.volunteerRoleId))
		.leftJoin(event, eq(event.id, volunteerShift.eventId))
		.where(and(isNull(volunteerShift.cancelledAt), gte(volunteerShift.startsAt, now)))
		.orderBy(asc(volunteerShift.startsAt))
		.limit(opts.limit ?? 50);

	return rows
		.map((r) => ({
			...r.shift,
			roleName: r.roleName,
			roleGroup: r.roleGroup,
			eventTitle: r.eventTitle,
			claimed: Number(r.claimed),
			myStatus: r.myStatus,
			mySignupId: r.mySignupId,
			interested: Number(r.interested) > 0,
			isFull: Number(r.claimed) >= r.shift.capacity
		}))
		.sort((a, b) => {
			// Already claimed first — it's the thing they most need to see — then
			// roles they said they'd help with, then everything else by date.
			const rank = (s: typeof a) => (s.myStatus ? 0 : s.interested ? 1 : 2);
			return rank(a) - rank(b) || a.startsAt.getTime() - b.startsAt.getTime();
		});
}

/** A member's own upcoming and recent commitments. */
export async function listMyShifts(userId: string): Promise<ShiftWithCounts[]> {
	const rows = await db
		.select({
			shift: volunteerShift,
			roleName: volunteerRole.name,
			roleGroup: volunteerRole.group,
			eventTitle: event.title,
			claimed: sql<number>`0`
		})
		.from(volunteerSignup)
		.innerJoin(volunteerShift, eq(volunteerShift.id, volunteerSignup.shiftId))
		.innerJoin(volunteerRole, eq(volunteerRole.id, volunteerShift.volunteerRoleId))
		.leftJoin(event, eq(event.id, volunteerShift.eventId))
		.where(and(eq(volunteerSignup.userId, userId), ne(volunteerSignup.status, 'cancelled')))
		.orderBy(asc(volunteerShift.startsAt));

	return withCounts(rows);
}
