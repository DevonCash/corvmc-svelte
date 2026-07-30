import { query } from '$app/server';
import {
	listPublicCalendarEvents,
	listPublicUpcomingEvents,
	type CalendarEventRow
} from '$lib/server/event/event-service';
import { isFeatureEnabled } from '$lib/server/feature-flags';
import { buildDateInTz, formatDateInTz } from '$lib/server/reservation/timezone';
import { resolveImageUrl } from '$lib/server/storage';
import { DEFAULT_TIMEZONE } from '$lib/config';
import {
	monthSchema,
	gigGuideSchema,
	GIG_GUIDE_PAGE_SIZE,
	type CalendarEntry
} from '$lib/types/calendar';

// ---------------------------------------------------------------------------
// Public calendar — unified month view across CMC and band events
// ---------------------------------------------------------------------------

/** First-of-month "YYYY-MM-DD" strings for a month and the month after it. */
function monthBounds(month: string): { start: string; end: string } {
	const [year, mo] = month.split('-').map(Number);
	const nextYear = mo === 12 ? year + 1 : year;
	const nextMo = mo === 12 ? 1 : mo + 1;
	return {
		start: `${month}-01`,
		end: `${nextYear}-${String(nextMo).padStart(2, '0')}-01`
	};
}

function toCalendarEntry(e: CalendarEventRow): CalendarEntry {
	return {
		id: e.id,
		title: e.title,
		startsAt: e.startsAt,
		endsAt: e.endsAt,
		source: e.source,
		location: e.location,
		bandName: e.bandName,
		bandSlug: e.bandSlug,
		posterUrl: resolveImageUrl(e.posterKey),
		ticketingEnabled: e.ticketingEnabled,
		ticketPrice: e.ticketPrice,
		externalTicketUrl: e.externalTicketUrl,
		href: `/events/${e.id}`
	};
}

/**
 * Continuous upcoming list for the gig guide: events from `from` (default
 * today, venue time) forward, paged by offset.
 */
export const getPublicGigGuide = query(gigGuideSchema, async ({ from, offset }) => {
	const anchor = from ?? formatDateInTz(new Date(), DEFAULT_TIMEZONE);
	const windowStart = buildDateInTz(anchor, '00:00', DEFAULT_TIMEZONE);

	const bandEventsEnabled = await isFeatureEnabled('bandEvents');
	const rows = await listPublicUpcomingEvents(windowStart, {
		includeBandEvents: bandEventsEnabled,
		limit: GIG_GUIDE_PAGE_SIZE,
		offset
	});

	const hasMore = rows.length > GIG_GUIDE_PAGE_SIZE;
	return {
		from: anchor,
		bandEventsEnabled,
		hasMore,
		events: rows.slice(0, GIG_GUIDE_PAGE_SIZE).map(toCalendarEntry)
	};
});

export const getPublicCalendar = query(monthSchema, async ({ month }) => {
	// The window is computed in venue time so events land on the venue-local month.
	const { start, end } = monthBounds(month);
	const windowStart = buildDateInTz(start, '00:00', DEFAULT_TIMEZONE);
	const windowEnd = buildDateInTz(end, '00:00', DEFAULT_TIMEZONE);

	const bandEventsEnabled = await isFeatureEnabled('bandEvents');
	const rows = await listPublicCalendarEvents(windowStart, windowEnd, {
		includeBandEvents: bandEventsEnabled
	});

	return {
		month,
		bandEventsEnabled,
		events: rows.map(toCalendarEntry)
	};
});
