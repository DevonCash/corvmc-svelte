import { describe, it, expect } from 'vitest';
import { computeReservationCredit } from './reservation-credit-service';

// hourlyRateCents 1500 ($15/hr) → creditValueCents = 750 (30-min block),
// hoursToCredits(hours) = hours * 2.
const RATE = 1500;

describe('computeReservationCredit', () => {
	it('applies no credit when the balance is zero', () => {
		const r = computeReservationCredit({
			totalCents: 3000,
			durationHours: 2,
			hourlyRateCents: RATE,
			freeHoursBalance: 0
		});
		expect(r).toEqual({ creditUnits: 0, creditDiscountCents: 0, remainingCents: 3000 });
	});

	it('fully covers a session when the balance is ample', () => {
		const r = computeReservationCredit({
			totalCents: 3000,
			durationHours: 2,
			hourlyRateCents: RATE,
			freeHoursBalance: 12
		});
		// 2 hr → 4 credits needed, 4 × 750 = 3000 = total.
		expect(r).toEqual({ creditUnits: 4, creditDiscountCents: 3000, remainingCents: 0 });
	});

	it('partially covers, leaving a cash remainder', () => {
		const r = computeReservationCredit({
			totalCents: 3000,
			durationHours: 2,
			hourlyRateCents: RATE,
			freeHoursBalance: 2 // 2 credits = 1 hour
		});
		expect(r).toEqual({ creditUnits: 2, creditDiscountCents: 1500, remainingCents: 1500 });
	});

	it('never discounts more than the total when balance exceeds need', () => {
		const r = computeReservationCredit({
			totalCents: 1500,
			durationHours: 1,
			hourlyRateCents: RATE,
			freeHoursBalance: 50
		});
		// 1 hr → 2 credits needed; discount capped at total.
		expect(r.creditUnits).toBe(2);
		expect(r.creditDiscountCents).toBe(1500);
		expect(r.remainingCents).toBe(0);
	});

	it('handles half-hour sessions (1 credit)', () => {
		const r = computeReservationCredit({
			totalCents: 750,
			durationHours: 0.5,
			hourlyRateCents: RATE,
			freeHoursBalance: 5
		});
		expect(r).toEqual({ creditUnits: 1, creditDiscountCents: 750, remainingCents: 0 });
	});
});
