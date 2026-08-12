import { describe, it, expect } from 'vitest';
import { parseGigImport, GIG_IMPORT_MAX_LINES } from './gig-import';

// Fixed "today" so the past-date rule doesn't depend on the clock.
const TODAY = new Date('2026-08-12T12:00:00Z');

describe('parseGigImport', () => {
	it('parses a full pipe-delimited line', () => {
		const { rows, errors } = parseGigImport(
			'2024-03-14 | Bombs Away Cafe | Spring Blowout | https://tickets.example/1',
			TODAY
		);

		expect(errors).toEqual([]);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			date: '2024-03-14',
			location: 'Bombs Away Cafe',
			title: 'Spring Blowout',
			externalTicketUrl: 'https://tickets.example/1',
			support: []
		});
	});

	it('accepts tab-delimited lines, for spreadsheet pastes', () => {
		const { rows } = parseGigImport('2024-03-14\tBombs Away Cafe\tSpring Blowout', TODAY);
		expect(rows[0]).toMatchObject({ location: 'Bombs Away Cafe', title: 'Spring Blowout' });
	});

	it('falls back to the venue, then a generic title', () => {
		const { rows } = parseGigImport('2024-03-14 | Bombs Away Cafe\n2024-04-01', TODAY);
		expect(rows[0].title).toBe('Live at Bombs Away Cafe');
		expect(rows[1].title).toBe('Live show');
	});

	// The credit/consent rule at the import boundary: a paste of old gigs names
	// bands that mostly aren't on CMC, and must never fan out invitations.
	it('splits a `w/` title into support credits', () => {
		const { rows } = parseGigImport('2024-03-14 | The Venue | w/ Paper Wolves, Sun Kissed', TODAY);
		expect(rows[0].support).toEqual(['Paper Wolves', 'Sun Kissed']);
		expect(rows[0].title).toBe('Live at The Venue');
	});

	it('does not treat an ordinary title as a credit list', () => {
		const { rows } = parseGigImport('2024-03-14 | The Venue | Winter Warmer', TODAY);
		expect(rows[0].support).toEqual([]);
		expect(rows[0].title).toBe('Winter Warmer');
	});

	it('rejects future dates — this is a backfill tool', () => {
		const { rows, errors } = parseGigImport('2027-01-01 | The Venue', TODAY);
		expect(rows).toEqual([]);
		expect(errors[0]).toMatchObject({ line: 1 });
		expect(errors[0].message).toMatch(/future/i);
	});

	it('rejects today, since the gig has not happened yet', () => {
		const { rows } = parseGigImport('2026-08-12 | The Venue', TODAY);
		expect(rows).toEqual([]);
	});

	it('reports malformed dates against their line number', () => {
		const { rows, errors } = parseGigImport(
			'2024-03-14 | Good\nnot-a-date | Bad\n2024-05-05 | Also good',
			TODAY
		);
		expect(rows.map((r) => r.date)).toEqual(['2024-03-14', '2024-05-05']);
		expect(errors).toEqual([expect.objectContaining({ line: 2 })]);
	});

	it('rejects a date that looks valid but is not a real day', () => {
		// new Date('2024-02-31') silently rolls into March.
		const { rows, errors } = parseGigImport('2024-02-31 | The Venue', TODAY);
		expect(rows).toEqual([]);
		expect(errors).toHaveLength(1);
	});

	it('numbers lines against the original text, not the non-blank subset', () => {
		const { errors } = parseGigImport('\n\n2024-03-14 | Fine\n\nnot-a-date | Bad', TODAY);
		expect(errors[0].line).toBe(5);
	});

	it('refuses more than the line cap', () => {
		const text = Array.from({ length: GIG_IMPORT_MAX_LINES + 1 }, () => '2024-03-14 | V').join(
			'\n'
		);
		const { rows, errors } = parseGigImport(text, TODAY);
		expect(rows).toEqual([]);
		expect(errors[0].message).toMatch(/too many/i);
	});

	it('accepts exactly the line cap', () => {
		const text = Array.from({ length: GIG_IMPORT_MAX_LINES }, () => '2024-03-14 | V').join('\n');
		expect(parseGigImport(text, TODAY).rows).toHaveLength(GIG_IMPORT_MAX_LINES);
	});

	it('skips an over-long line without dropping the rest', () => {
		const { rows, errors } = parseGigImport(
			`2024-03-14 | ${'x'.repeat(700)}\n2024-04-01 | The Venue`,
			TODAY
		);
		expect(rows).toHaveLength(1);
		expect(errors[0]).toMatchObject({ line: 1 });
	});

	it('ignores blank lines and surrounding whitespace', () => {
		const { rows, errors } = parseGigImport('\n  2024-03-14  |  The Venue  \n\n', TODAY);
		expect(errors).toEqual([]);
		expect(rows).toEqual([expect.objectContaining({ location: 'The Venue' })]);
	});
});
