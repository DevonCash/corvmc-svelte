import { describe, it, expect } from 'vitest';
import { createEventSchema } from '$lib/server/db/schema/event';

// Regression: enabling ticketing without a valid price used to pass schema
// validation, then throw inside the event service and surface to the user as a
// 500 "Internal Error". The schema now rejects it as a field-level issue.
describe('createEventSchema ticketing validation', () => {
	const base = {
		title: 'Open Mic Night',
		eventDate: '2026-07-15',
		eventStartTime: '19:00',
		eventEndTime: '22:00'
	};

	it('rejects ticketing enabled with a blank price', () => {
		const result = createEventSchema.safeParse({
			...base,
			ticketingEnabled: true,
			ticketPrice: ''
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.path.includes('ticketPrice'))).toBe(true);
		}
	});

	it('rejects ticketing enabled with a zero price', () => {
		const result = createEventSchema.safeParse({
			...base,
			ticketingEnabled: true,
			ticketPrice: '0'
		});
		expect(result.success).toBe(false);
	});

	it('accepts ticketing enabled with a valid price', () => {
		const result = createEventSchema.safeParse({
			...base,
			ticketingEnabled: true,
			ticketPrice: '1500'
		});
		expect(result.success).toBe(true);
	});

	it('accepts ticketing disabled with a blank price', () => {
		const result = createEventSchema.safeParse({
			...base,
			ticketingEnabled: false,
			ticketPrice: ''
		});
		expect(result.success).toBe(true);
	});
});
