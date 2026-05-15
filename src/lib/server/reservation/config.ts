/** Per-hour cost for practice room in cents ($15.00) */
export const HOURLY_RATE_CENTS = 1500;

/** Granularity of bookable time slots in minutes */
export const TIME_SLOT_MINUTES = 30;

/** Minimum reservation duration in hours */
export const MIN_DURATION_HOURS = 1;

/** Maximum reservation duration in hours */
export const MAX_DURATION_HOURS = 8;

/** Earliest bookable time (24h format) */
export const OPERATING_HOURS_START = '09:00';

/** Latest end time (24h format) */
export const OPERATING_HOURS_END = '22:00';

/** Required gap between back-to-back reservations in minutes */
export const BUFFER_MINUTES = 0;

/** Maximum days ahead a one-off reservation can be booked */
export const MAX_ADVANCE_DAYS_ONEOFF = 14;

/** Generation window for recurring series (2.5 weeks) */
export const MAX_ADVANCE_DAYS_RECURRING = 17.5;

/** Allowed recurrence frequencies */
export const RECURRING_FREQUENCIES = ['weekly', 'biweekly', 'monthly'] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];
