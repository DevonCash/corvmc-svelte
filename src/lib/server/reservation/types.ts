import { z } from 'zod';

// ---------------------------------------------------------------------------
// Booker types
// ---------------------------------------------------------------------------

export const bookerTypes = ['user', 'band', 'event', 'lesson'] as const;
export type BookerType = (typeof bookerTypes)[number];

export function isBookerType(value: string): value is BookerType {
	return bookerTypes.includes(value as BookerType);
}

// ---------------------------------------------------------------------------
// Reservation statuses
// ---------------------------------------------------------------------------

export const reservationStatuses = ['scheduled', 'confirmed', 'completed', 'no_show', 'cancelled'] as const;
export type ReservationStatus = (typeof reservationStatuses)[number];

// ---------------------------------------------------------------------------
// Time slot representation
// ---------------------------------------------------------------------------

export interface TimeSlot {
	/** 24h format "HH:MM" */
	startTime: string;
	/** 24h format "HH:MM" */
	endTime: string;
	available: boolean;
}

// ---------------------------------------------------------------------------
// Form validation schemas
// ---------------------------------------------------------------------------

export const createReservationSchema = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
	startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
	endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
	notes: z.string().optional()
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
