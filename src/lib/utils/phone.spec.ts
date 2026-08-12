import { describe, it, expect } from 'vitest';
import { phoneDigits, normalizePhone, isValidPhone } from './phone';

describe('phoneDigits', () => {
	it('strips punctuation, spaces, and a leading plus', () => {
		expect(phoneDigits('+1 (541) 555-0123')).toBe('15415550123');
	});
});

describe('normalizePhone', () => {
	it('keeps a 10-digit number as typed, minus formatting', () => {
		expect(normalizePhone('(541) 555-0123')).toBe('5415550123');
		expect(normalizePhone('541-555-0123')).toBe('5415550123');
	});

	it('keeps a number that already carries a country code', () => {
		expect(normalizePhone('+1 541 555 0123')).toBe('15415550123');
	});

	it('restores the leading 1 on a 9-digit entry', () => {
		expect(normalizePhone('415550123')).toBe('1415550123');
	});

	it('rejects anything with fewer than 9 digits', () => {
		expect(normalizePhone('')).toBeNull();
		expect(normalizePhone(null)).toBeNull();
		expect(normalizePhone(undefined)).toBeNull();
		expect(normalizePhone('n/a')).toBeNull();
		expect(normalizePhone('1234')).toBeNull();
		expect(normalizePhone('12345678')).toBeNull();
	});

	it('rejects more digits than any real number has', () => {
		expect(normalizePhone('1234567890123456')).toBeNull();
	});
});

describe('isValidPhone', () => {
	it('tracks normalizePhone', () => {
		expect(isValidPhone('(541) 555-0123')).toBe(true);
		expect(isValidPhone('415550123')).toBe(true);
		expect(isValidPhone('n/a')).toBe(false);
		expect(isValidPhone(null)).toBe(false);
	});
});
