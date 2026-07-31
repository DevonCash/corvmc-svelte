import { describe, it, expect } from 'vitest';
import { isHttpError } from '@sveltejs/kit';
import { mapDomainError } from './errors';
import {
	ReservationStateError,
	ReservationNotFoundError,
	ReservationAuthorizationError
} from './reservation/reservation-service';
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

	it('maps ReservationNotFoundError to a 404 HttpError', () => {
		try {
			mapDomainError(new ReservationNotFoundError());
			expect.unreachable('should have thrown');
		} catch (err) {
			expect(isHttpError(err)).toBe(true);
			if (isHttpError(err)) {
				expect(err.status).toBe(404);
				expect(err.body.message).toContain('not found');
			}
		}
	});

	it('maps ReservationAuthorizationError to a 403 HttpError', () => {
		try {
			mapDomainError(
				new ReservationAuthorizationError('Not authorized to cancel this reservation')
			);
			expect.unreachable('should have thrown');
		} catch (err) {
			expect(isHttpError(err)).toBe(true);
			if (isHttpError(err)) {
				expect(err.status).toBe(403);
				expect(err.body.message).toContain('Not authorized');
			}
		}
	});

	it('re-throws unknown errors for SvelteKit default 500 handling', () => {
		const unknown = new Error('boom');
		expect(() => mapDomainError(unknown)).toThrow(unknown);
	});
});
