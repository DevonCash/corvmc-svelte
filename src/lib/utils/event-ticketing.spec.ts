import { describe, it, expect } from 'vitest';
import { dollarsToCents, centsToDollars, MAX_TICKET_PRICE_CENTS } from './event-ticketing';

describe('dollarsToCents', () => {
	it('converts a whole-dollar amount', () => {
		expect(dollarsToCents('15')).toBe(1500);
	});

	it('converts an amount with cents', () => {
		expect(dollarsToCents('12.50')).toBe(1250);
	});

	it('rounds away binary floating-point error', () => {
		// 15.10 * 100 is 1509.9999999999998 in IEEE 754 — truncating here would
		// under-charge by a cent on a very common price.
		expect(dollarsToCents('15.10')).toBe(1510);
	});

	it('rounds a sub-cent amount to the nearest cent', () => {
		expect(dollarsToCents('9.999')).toBe(1000);
	});

	it('accepts a number as well as a string', () => {
		expect(dollarsToCents(7.25)).toBe(725);
	});

	it('ignores surrounding whitespace', () => {
		expect(dollarsToCents('  20.00  ')).toBe(2000);
	});

	it('treats zero as a real price', () => {
		expect(dollarsToCents('0')).toBe(0);
	});

	it.each([
		['an empty string', ''],
		['blank space', '   '],
		['non-numeric text', 'free'],
		['a partially numeric string', '12 dollars'],
		['a negative amount', '-5']
	])('returns null for %s', (_label, input) => {
		expect(dollarsToCents(input)).toBeNull();
	});

	it.each([
		['null', null],
		['undefined', undefined]
	])('returns null for %s', (_label, input) => {
		expect(dollarsToCents(input)).toBeNull();
	});

	it('returns null above the sanity ceiling', () => {
		expect(dollarsToCents(MAX_TICKET_PRICE_CENTS / 100 + 1)).toBeNull();
	});

	it('accepts an amount exactly at the ceiling', () => {
		expect(dollarsToCents(MAX_TICKET_PRICE_CENTS / 100)).toBe(MAX_TICKET_PRICE_CENTS);
	});
});

describe('centsToDollars', () => {
	it('renders cents with two decimal places', () => {
		expect(centsToDollars(1500)).toBe('15.00');
	});

	it('keeps a partial-dollar amount', () => {
		expect(centsToDollars(1250)).toBe('12.50');
	});

	it.each([
		['null', null],
		['undefined', undefined]
	])('renders %s as an empty string so the input stays blank', (_label, input) => {
		expect(centsToDollars(input)).toBe('');
	});

	it('round-trips through dollarsToCents', () => {
		expect(dollarsToCents(centsToDollars(1899))).toBe(1899);
	});
});
