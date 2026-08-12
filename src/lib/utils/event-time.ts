import { formatTime, formatTimeRange } from './format';

/**
 * What a missing end time means.
 *
 * `event.endsAt` is nullable so a band backfilling old gigs doesn't have to
 * invent one — see the column comment in the event schema. That leaves two
 * questions every display surface would otherwise answer for itself, so both
 * live here instead:
 *
 *   - how to render the time
 *   - whether the show is over
 *
 * CMC events always have an end (enforced by the `event_cmc_needs_end` check),
 * so in practice this only softens band gigs.
 */

/** "8:00 PM – 11:00 PM", or just "8:00 PM" when the end is unknown. */
export function formatEventTimeRange(startsAt: Date, endsAt: Date | null): string {
	return endsAt ? formatTimeRange(startsAt, endsAt) : formatTime(startsAt);
}

/**
 * Has the show finished?
 *
 * With a known end it's a plain comparison. Without one, the gig counts as
 * running for the rest of its calendar day rather than ending the moment it
 * starts — otherwise a door-time listing would flip to "past" and hide its own
 * ticket link while the band was still loading in.
 */
export function hasEventEnded(
	startsAt: Date,
	endsAt: Date | null,
	now: Date = new Date()
): boolean {
	if (endsAt) return endsAt.getTime() < now.getTime();

	const dayAfterStart = new Date(startsAt);
	dayAfterStart.setHours(24, 0, 0, 0);
	return dayAfterStart.getTime() <= now.getTime();
}
