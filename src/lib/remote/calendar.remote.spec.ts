import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('$app/server', () => ({
	query: (...args: unknown[]) => {
		const handler = (typeof args[0] === 'function' ? args[0] : args[1]) as (
			...a: unknown[]
		) => unknown;
		(handler as unknown as Record<string, unknown>).__ = { type: 'query' };
		return handler;
	}
}));

const listPublicCalendarEvents = vi.fn(async (..._args: unknown[]) => [] as unknown[]);
const listPublicUpcomingEvents = vi.fn(async (..._args: unknown[]) => [] as unknown[]);
vi.mock('$lib/server/event/event-service', () => ({
	listPublicCalendarEvents: (...args: unknown[]) => listPublicCalendarEvents(...(args as [])),
	listPublicUpcomingEvents: (...args: unknown[]) => listPublicUpcomingEvents(...(args as []))
}));

let bandEventsEnabled = false;
vi.mock('$lib/server/feature-flags', () => ({
	isFeatureEnabled: vi.fn(async () => bandEventsEnabled)
}));

vi.mock('$lib/server/storage', () => ({
	resolveImageUrl: (key: string | null) => key
}));

import { getPublicCalendar, getPublicGigGuide } from './calendar.remote';
import { monthSchema, gigGuideSchema, GIG_GUIDE_PAGE_SIZE } from '$lib/types/calendar';
import { formatDateInTz } from '$lib/server/reservation/timezone';
import { DEFAULT_TIMEZONE } from '$lib/config';

function fakeRow(id: string) {
	return {
		id,
		title: id,
		source: 'cmc',
		startsAt: new Date('2026-08-08T02:00:00Z'),
		endsAt: new Date('2026-08-08T05:00:00Z'),
		location: null,
		bandName: null,
		bandSlug: null,
		posterKey: null,
		ticketingEnabled: false,
		ticketPrice: null,
		externalTicketUrl: null
	};
}

describe('monthSchema', () => {
	it.each(['2026-08', '2026-01', '2026-12', '1999-07'])('accepts %s', (month) => {
		expect(monthSchema.safeParse({ month }).success).toBe(true);
	});

	it.each(['2026-8', '2026-13', '2026-00', '2026', '2026-08-01', 'garbage', ''])(
		'rejects %s',
		(month) => {
			expect(monthSchema.safeParse({ month }).success).toBe(false);
		}
	);
});

describe('gigGuideSchema', () => {
	it.each(['2026-08-01', '2026-12-31', '2026-02-09'])('accepts from=%s', (from) => {
		expect(gigGuideSchema.safeParse({ from, offset: 0 }).success).toBe(true);
	});

	it('accepts a missing from and defaults offset to 0', () => {
		const parsed = gigGuideSchema.safeParse({});
		expect(parsed.success).toBe(true);
		if (parsed.success) expect(parsed.data.offset).toBe(0);
	});

	it.each(['2026-08', '2026-08-32', '2026-13-01', 'garbage', ''])('rejects from=%s', (from) => {
		expect(gigGuideSchema.safeParse({ from, offset: 0 }).success).toBe(false);
	});

	it('rejects negative and fractional offsets', () => {
		expect(gigGuideSchema.safeParse({ offset: -1 }).success).toBe(false);
		expect(gigGuideSchema.safeParse({ offset: 1.5 }).success).toBe(false);
	});
});

describe('getPublicCalendar', () => {
	beforeEach(() => {
		listPublicCalendarEvents.mockClear();
		bandEventsEnabled = false;
	});

	it('queries a first-of-month to first-of-next-month window in venue time', async () => {
		await getPublicCalendar({ month: '2026-08' });

		const [start, end] = listPublicCalendarEvents.mock.calls[0] as unknown as [Date, Date];
		expect(formatDateInTz(start, DEFAULT_TIMEZONE)).toBe('2026-08-01');
		expect(formatDateInTz(end, DEFAULT_TIMEZONE)).toBe('2026-09-01');
	});

	it('rolls December over to January of the next year', async () => {
		await getPublicCalendar({ month: '2026-12' });

		const [, end] = listPublicCalendarEvents.mock.calls[0] as unknown as [Date, Date];
		expect(formatDateInTz(end, DEFAULT_TIMEZONE)).toBe('2027-01-01');
	});

	it('passes the bandEvents flag through as includeBandEvents', async () => {
		await getPublicCalendar({ month: '2026-08' });
		expect(listPublicCalendarEvents.mock.calls[0][2]).toEqual({ includeBandEvents: false });

		bandEventsEnabled = true;
		await getPublicCalendar({ month: '2026-08' });
		expect(listPublicCalendarEvents.mock.calls[1][2]).toEqual({ includeBandEvents: true });
	});
});

describe('getPublicGigGuide', () => {
	beforeEach(() => {
		listPublicUpcomingEvents.mockClear();
		listPublicUpcomingEvents.mockResolvedValue([]);
		bandEventsEnabled = false;
	});

	it('defaults the anchor to today in venue time', async () => {
		const result = await getPublicGigGuide({ offset: 0 });
		const today = formatDateInTz(new Date(), DEFAULT_TIMEZONE);
		expect(result.from).toBe(today);

		const [start] = listPublicUpcomingEvents.mock.calls[0] as unknown as [Date];
		expect(formatDateInTz(start, DEFAULT_TIMEZONE)).toBe(today);
	});

	it('anchors the window at an explicit from date', async () => {
		await getPublicGigGuide({ from: '2026-08-01', offset: 0 });
		const [start] = listPublicUpcomingEvents.mock.calls[0] as unknown as [Date];
		expect(formatDateInTz(start, DEFAULT_TIMEZONE)).toBe('2026-08-01');
	});

	it('derives hasMore from the limit+1 probe row and trims it', async () => {
		listPublicUpcomingEvents.mockResolvedValue(
			Array.from({ length: GIG_GUIDE_PAGE_SIZE + 1 }, (_, i) => fakeRow(`evt-${i}`))
		);

		const result = await getPublicGigGuide({ offset: 0 });
		expect(result.hasMore).toBe(true);
		expect(result.events).toHaveLength(GIG_GUIDE_PAGE_SIZE);
	});

	it('reports no more when a short page comes back', async () => {
		listPublicUpcomingEvents.mockResolvedValue([fakeRow('evt-1')]);
		const result = await getPublicGigGuide({ offset: 0 });
		expect(result.hasMore).toBe(false);
		expect(result.events).toHaveLength(1);
	});

	it('passes the flag and paging through to the service', async () => {
		bandEventsEnabled = true;
		await getPublicGigGuide({ offset: 40 });
		expect(listPublicUpcomingEvents.mock.calls[0][1]).toEqual({
			includeBandEvents: true,
			limit: GIG_GUIDE_PAGE_SIZE,
			offset: 40
		});
	});
});
