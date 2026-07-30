import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — a select chain that records the where clause so the source filter
// can be asserted, and resolves to configurable joined rows.
// ---------------------------------------------------------------------------

let capturedWhere: unknown;
let selectRows: unknown[] = [];

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => ({
			from: () => ({
				leftJoin: () => ({
					where: (clause: unknown) => {
						capturedWhere = clause;
						return { orderBy: () => Promise.resolve(selectRows) };
					}
				})
			})
		})
	},
	getRowCount: () => 0
}));

vi.mock('$lib/server/reservation/reservation-service', () => ({
	staffCreate: vi.fn(),
	cancel: vi.fn(),
	ReservationConflictError: class extends Error {}
}));
vi.mock('$lib/server/reservation/conflict-service', () => ({ hasConflict: vi.fn() }));
vi.mock('$lib/server/events/event-bus', () => ({ domainEvents: { emit: vi.fn() } }));
vi.mock('$lib/server/storage', () => ({ uploadFile: vi.fn(), deleteObject: vi.fn() }));

import { listPublicCalendarEvents } from './event-service';

/** Depth-first search of a drizzle SQL tree for a bound parameter value. */
function containsParam(node: unknown, value: unknown): boolean {
	if (!node || typeof node !== 'object') return false;
	if ((node as { value?: unknown }).value === value) return true;
	const chunks = (node as { queryChunks?: unknown[] }).queryChunks;
	return Array.isArray(chunks) && chunks.some((c) => containsParam(c, value));
}

const cmcEvent = {
	id: 'evt-cmc',
	title: 'Open Mic Night',
	source: 'cmc',
	startsAt: new Date('2026-08-08T02:00:00Z'),
	endsAt: new Date('2026-08-08T05:00:00Z')
};

const bandEvent = {
	id: 'evt-band',
	title: 'Basement Show',
	source: 'band',
	startsAt: new Date('2026-08-09T02:00:00Z'),
	endsAt: new Date('2026-08-09T05:00:00Z')
};

const windowStart = new Date('2026-08-01T07:00:00Z');
const windowEnd = new Date('2026-09-01T07:00:00Z');

describe('listPublicCalendarEvents', () => {
	beforeEach(() => {
		capturedWhere = undefined;
		selectRows = [];
	});

	it('maps joined band info onto rows, null for CMC rows', async () => {
		selectRows = [
			{ event: cmcEvent, bandName: null, bandSlug: null },
			{ event: bandEvent, bandName: 'The Shakes', bandSlug: 'the-shakes' }
		];

		const result = await listPublicCalendarEvents(windowStart, windowEnd, {
			includeBandEvents: true
		});

		expect(result).toHaveLength(2);
		expect(result[0]).toMatchObject({ id: 'evt-cmc', bandName: null, bandSlug: null });
		expect(result[1]).toMatchObject({
			id: 'evt-band',
			bandName: 'The Shakes',
			bandSlug: 'the-shakes'
		});
	});

	it('filters to CMC-only when band events are excluded', async () => {
		await listPublicCalendarEvents(windowStart, windowEnd, { includeBandEvents: false });
		expect(containsParam(capturedWhere, 'cmc')).toBe(true);
	});

	it('applies no source filter when band events are included', async () => {
		await listPublicCalendarEvents(windowStart, windowEnd, { includeBandEvents: true });
		expect(containsParam(capturedWhere, 'cmc')).toBe(false);
	});

	it('always filters to published events', async () => {
		await listPublicCalendarEvents(windowStart, windowEnd, { includeBandEvents: true });
		expect(containsParam(capturedWhere, 'published')).toBe(true);
	});
});
