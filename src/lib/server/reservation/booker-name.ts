import { sql, type SQL, type Column } from 'drizzle-orm';
import { user } from '$lib/server/db/schema/authentication';
import { band } from '$lib/server/db/schema/band';
import { event } from '$lib/server/db/schema/event';

/**
 * SQL fragment that resolves the polymorphic booker's display name from its
 * `bookerType` + `bookerId`. Use inside a drizzle `.select()` to compute the
 * name inline for list/detail queries, e.g.
 * `bookerName: bookerNameFor(reservation.bookerType, reservation.bookerId)`.
 * Mirrors `primaryRoleFor` / `isSustainingMemberSql`.
 *
 * Resolves user → user.name, band → band.name, event → event.title. The
 * 'lesson' booker type has no table yet, so it falls through to null.
 */
export function bookerNameFor(typeCol: SQL | Column, idCol: SQL | Column) {
	return sql<string | null>`(
		case ${typeCol}
			when 'user' then (select u.name from ${user} u where u.id = ${idCol})
			when 'band' then (select b.name from ${band} b where b.id = ${idCol})
			when 'event' then (select e.title from ${event} e where e.id = ${idCol})
			else null
		end
	)`;
}
