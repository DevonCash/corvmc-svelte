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

const listPublicCalendarEvents = vi.fn(async (..._args: unknown[]) => []);
vi.mock('$lib/server/event/event-service', () => ({
	listPublicCalendarEvents: (...args: unknown[]) => listPublicCalendarEvents(...(args as []))
}));

let bandEventsEnabled = false;
vi.mock('$lib/server/feature-flags', () => ({
	isFeatureEnabled: vi.fn(async () => bandEventsEnabled)
}));

vi.mock('$lib/server/storage', () => ({
	resolveImageUrl: (key: string | null) => key
}));

import { getPublicCalendar } from './calendar.remote';
import { monthSchema } from '$lib/types/calendar';
import { formatDateInTz } from '$lib/server/reservation/timezone';
import { DEFAULT_TIMEZONE } from '$lib/config';

describe('monthSchema', () => {
	it.each(['2026-08', '2026-01', '2026-12', '1999-07'])('accepts %s', (month) => {
		expect(monthSchema.safeParse({ month }).success).toBe(true);
	});

	it.each([
		'2026-8', // month must be zero-padded
		'2026-13', // no 13th month
		'2026-00',
		'2026', // year alone
		'2026-08-01', // full dates are not months
		'garbage',
		''
	])('rejects %s', (month) => {
		expect(monthSchema.safeParse({ month }).success).toBe(false);
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
