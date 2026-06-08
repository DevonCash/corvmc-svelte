import { describe, it, expect } from 'vitest';
import { isHttpError } from '@sveltejs/kit';
import { mapDomainError } from './errors';
import { ReservationStateError } from './reservation/reservation-service';
import { SubscriptionStateError } from './finance/subscription-service';

describe('mapDomainError', () => {
	it('maps ReservationStateError to a 409 HttpError', () => {
		try {
			mapDomainError(
				new ReservationStateError('Cannot cancel a reservation with status "cancelled"')
			);
			expect.unreachable('should have thrown');
		} catch (err) {
			expect(isHttpError(err)).toBe(true);
			if (isHttpError(err)) {
				expect(err.status).toBe(409);
				expect(err.body.message).toContain('Cannot cancel');
			}
		}
	});

	it('maps SubscriptionStateError to a 409 HttpError', () => {
		try {
			mapDomainError(new SubscriptionStateError('Contribution item not found on subscription'));
			expect.unreachable('should have thrown');
		} catch (err) {
			expect(isHttpError(err)).toBe(true);
			if (isHttpError(err)) {
				expect(err.status).toBe(409);
				expect(err.body.message).toContain('Contribution item not found');
			}
		}
	});

	it('re-throws unknown errors for SvelteKit default 500 handling', () => {
		const unknown = new Error('boom');
		expect(() => mapDomainError(unknown)).toThrow(unknown);
	});
});
