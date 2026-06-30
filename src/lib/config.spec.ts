import { describe, it, expect } from 'vitest';
import { CONFIRMATION_WINDOW_DAYS, confirmWindowOpensAt, withinConfirmationWindow } from './config';

const DAY = 24 * 60 * 60 * 1000;

describe('confirmation window helpers', () => {
	const start = new Date('2026-07-10T18:00:00Z');

	it('opens exactly CONFIRMATION_WINDOW_DAYS before the start', () => {
		const opens = confirmWindowOpensAt(start);
		expect(start.getTime() - opens.getTime()).toBe(CONFIRMATION_WINDOW_DAYS * DAY);
	});

	it('is outside the window before it opens', () => {
		const now = new Date(start.getTime() - (CONFIRMATION_WINDOW_DAYS * DAY + 1000));
		expect(withinConfirmationWindow(start, now)).toBe(false);
	});

	it('is inside the window from the moment it opens through the start', () => {
		expect(withinConfirmationWindow(start, confirmWindowOpensAt(start))).toBe(true);
		expect(withinConfirmationWindow(start, new Date(start.getTime() - DAY))).toBe(true);
		expect(withinConfirmationWindow(start, start)).toBe(true);
	});
});
