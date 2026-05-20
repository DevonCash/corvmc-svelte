import { getConfigsByPrefix } from '$lib/server/site-config/site-config-service';
export { RECURRING_FREQUENCIES, type RecurringFrequency } from '$lib/server/db/schema/recurring';

// ---------------------------------------------------------------------------
// Defaults — kept as named exports for tests and static references
// ---------------------------------------------------------------------------

export const DEFAULT_TIME_SLOT_MINUTES = 30;
export const DEFAULT_MIN_DURATION_HOURS = 1;
export const DEFAULT_MAX_DURATION_HOURS = 8;
export const DEFAULT_OPERATING_HOURS_START = '09:00';
export const DEFAULT_OPERATING_HOURS_END = '22:00';
export const DEFAULT_BUFFER_MINUTES = 0;
export const DEFAULT_MAX_ADVANCE_DAYS_ONEOFF = 14;
export const DEFAULT_MAX_ADVANCE_DAYS_RECURRING = 17.5;

// ---------------------------------------------------------------------------
// Async config — reads from site_config table with defaults fallback
// ---------------------------------------------------------------------------

export interface ReservationConfig {
	timeSlotMinutes: number;
	minDurationHours: number;
	maxDurationHours: number;
	operatingHoursStart: string;
	operatingHoursEnd: string;
	bufferMinutes: number;
	maxAdvanceDaysOneoff: number;
	maxAdvanceDaysRecurring: number;
}

export async function getReservationConfig(): Promise<ReservationConfig> {
	const raw = await getConfigsByPrefix('reservation');
	return {
		timeSlotMinutes: Number(raw.timeSlotMinutes ?? DEFAULT_TIME_SLOT_MINUTES),
		minDurationHours: Number(raw.minDurationHours ?? DEFAULT_MIN_DURATION_HOURS),
		maxDurationHours: Number(raw.maxDurationHours ?? DEFAULT_MAX_DURATION_HOURS),
		operatingHoursStart: String(raw.operatingHoursStart ?? DEFAULT_OPERATING_HOURS_START),
		operatingHoursEnd: String(raw.operatingHoursEnd ?? DEFAULT_OPERATING_HOURS_END),
		bufferMinutes: Number(raw.bufferMinutes ?? DEFAULT_BUFFER_MINUTES),
		maxAdvanceDaysOneoff: Number(raw.maxAdvanceDaysOneoff ?? DEFAULT_MAX_ADVANCE_DAYS_ONEOFF),
		maxAdvanceDaysRecurring: Number(raw.maxAdvanceDaysRecurring ?? DEFAULT_MAX_ADVANCE_DAYS_RECURRING)
	};
}
