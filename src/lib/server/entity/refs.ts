/**
 * Projecting a record into the `EntityRef` its components expect, from SQL.
 *
 * A ref should reach a component already knowing what it is: its glyph, its
 * subtitle and its status are decided once, here, rather than assembled by
 * whichever page happens to render it. `MemberLink` proved the alternative —
 * the role-versus-subscription rule was written out at the call site, so the
 * one page that forgot `sustaining` quietly showed sustaining members as
 * ordinary ones.
 *
 * Two halves, kept apart on purpose:
 *
 *  - `memberRefColumns` is the *projection* — drop it into a drizzle
 *    `.select()` under one key and the row comes back with a nested object.
 *  - `toMemberRef` is the *mapping*, and is pure apart from `resolveImageUrl`.
 *
 * **A ref may only use columns from joins the query already makes.** Where a
 * query has the user's id and name but no join to `user`, pass what it has and
 * accept a `null` image; adding a join per row to fetch an avatar is an N+1
 * dressed as a projection.
 */
import type { BuildAliasTable } from 'drizzle-orm/sqlite-core';
import { user } from '$lib/server/db/schema/authentication';
import { band } from '$lib/server/db/schema/band';
import { event } from '$lib/server/db/schema/event';
import { primaryRoleFor } from '$lib/server/authorization';
import { isSustainingMemberSql } from '$lib/server/finance/subscription-service';
import { resolveImageUrl } from '$lib/server/storage';
import { memberSubtype } from '$lib/utils/entity-ref';
import type { BandRef, EntityRef, EventRef, MemberRef } from '$lib/types/entity';

/**
 * The `user` table, or any `alias()` of it — the alias arm is what lets a query
 * that joins `user` twice project a ref for each side.
 */
type UserTable = typeof user | BuildAliasTable<typeof user, string>;

/**
 * The columns a member ref needs, for `select({ member: memberRefColumns(u) })`.
 *
 * `role` and `sustaining` are the two correlated subqueries the staff pages
 * already use one at a time; taking both together is what lets `toMemberRef`
 * apply the precedence rule instead of each page guessing at it.
 *
 * Both subqueries are keyed off the id column that is passed in, so an aliased
 * `user` correlates to its alias — which is what makes this usable on the
 * queries that join `user` twice (a booking's member and its approver).
 */
export function memberRefColumns(u: UserTable = user) {
	return {
		id: u.id,
		name: u.name,
		email: u.email,
		pronouns: u.pronouns,
		image: u.image,
		role: primaryRoleFor(u.id),
		sustaining: isSustainingMemberSql(u.id)
	};
}

/**
 * What `toMemberRef` needs, which is less than `memberRefColumns` returns.
 *
 * Every field past the id is optional so a query that only has a name and a
 * user id can still produce a ref — see the N+1 note above.
 */
export interface MemberRefRow {
	id: string | null;
	name: string | null;
	email?: string | null;
	pronouns?: string | null;
	/** A storage key, not a URL: `resolveImageUrl` runs here. */
	image?: string | null;
	role?: string | null;
	/** SQLite has no booleans, so the correlated subquery lands as 0 or 1. */
	sustaining?: boolean | number | null;
}

/**
 * A member ref, including for a member who is no longer there.
 *
 * A left join that missed — a reservation whose account was deleted — comes
 * back as `null` and still gets a ref: `id: null` renders an unlinked row, so
 * the history stays visible and the count stays honest. Losing the row instead
 * would silently change what a page reports.
 */
export function toMemberRef(row: MemberRefRow | null | undefined): MemberRef {
	return {
		type: 'member',
		id: row?.id ?? null,
		title: row?.name ?? 'Unknown member',
		subtitle: row?.email ?? null,
		pronouns: row?.pronouns ?? null,
		image: resolveImageUrl(row?.image),
		subtype: memberSubtype(row?.role, !!row?.sustaining)
	};
}

// ---------------------------------------------------------------------------
// Band
// ---------------------------------------------------------------------------

type BandTable = typeof band | BuildAliasTable<typeof band, string>;

/**
 * `slug` is not optional dressing: every band route outside the staff panel is
 * keyed by it, so a ref without one simply has fewer reachable pages.
 *
 * No status. A band's `tier` is the only state it has, and `premium` on every
 * premium band marks nothing — the rule the registry states for subtypes.
 */
export function bandRefColumns(b: BandTable = band) {
	return { id: b.id, name: b.name, slug: b.slug, image: b.avatarKey };
}

export interface BandRefRow {
	id: string | null;
	name: string | null;
	slug?: string | null;
	image?: string | null;
}

export function toBandRef(row: BandRefRow | null | undefined): BandRef {
	return {
		type: 'band',
		id: row?.id ?? null,
		title: row?.name ?? 'Unknown band',
		slug: row?.slug ?? null,
		image: resolveImageUrl(row?.image)
	};
}

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------

type EventTable = typeof event | BuildAliasTable<typeof event, string>;

export function eventRefColumns(e: EventTable = event) {
	return { id: e.id, title: e.title, status: e.status, startsAt: e.startsAt, image: e.posterKey };
}

export interface EventRefRow {
	id: string | null;
	title: string | null;
	status?: string | null;
	startsAt?: Date | null;
	image?: string | null;
}

export function toEventRef(row: EventRefRow | null | undefined): EventRef {
	return {
		type: 'event',
		id: row?.id ?? null,
		title: row?.title ?? 'Unknown event',
		status: row?.status ?? null,
		startsAt: row?.startsAt ?? null,
		image: resolveImageUrl(row?.image)
	};
}

// ---------------------------------------------------------------------------
// Booker
// ---------------------------------------------------------------------------

/**
 * Who a reservation is *for*, which is not one type of record.
 *
 * `bookerType` picks between three tables, so the ref does too — and the chip
 * that renders it carries its type glyph, which is how a reader tells a band's
 * booking from a member's without a column of icons beside it.
 *
 * The branch lives here rather than at the call site because it is a fact about
 * the data, and because a page that branched on it would be back to deciding
 * per-site what a booking looks like.
 *
 * `lesson` has no record to point at: nothing in this app writes that booker
 * type — it arrives with migrated rows — so it resolves to the member who holds
 * the booking, and the reservation keeps its own lesson glyph to say what it is.
 */
export function toBookerRef(row: {
	bookerType: string;
	member: MemberRefRow | null;
	band?: BandRefRow | null;
	event?: EventRefRow | null;
}): EntityRef {
	// A left join that missed — a deleted band, a purged event — still gets its
	// own ref rather than silently reporting as a member booking. `id: null`
	// renders unlinked, so the row stays honest about what it is.
	if (row.bookerType === 'band') return toBandRef(row.band);
	if (row.bookerType === 'event') return toEventRef(row.event);
	return toMemberRef(row.member);
}
