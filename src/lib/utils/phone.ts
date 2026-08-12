/**
 * Contact phone numbers. Deliberately permissive — the goal is to stop a
 * reservation arriving with no way to reach the member, not to reject anyone
 * whose number doesn't look North American.
 */

/** Digits only, no punctuation, spaces, or leading `+`. */
export function phoneDigits(value: string): string {
	return value.replace(/\D/g, '');
}

const MIN_DIGITS = 9;
const MAX_DIGITS = 15;

/**
 * The digits-only form to store, or null when there aren't enough digits to be
 * a real number.
 *
 * A 9-digit entry is a number typed without its leading 1, so the 1 is
 * restored. Anything longer is already complete and is left alone — including
 * numbers that already carry a country code.
 */
export function normalizePhone(value: string | null | undefined): string | null {
	if (!value) return null;
	const digits = phoneDigits(value);
	if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null;
	return digits.length === MIN_DIGITS ? `1${digits}` : digits;
}

/**
 * Whether a stored or submitted value is usable as a contact number. This — not
 * a truthiness check — is what decides "this member needs to enter a phone", so
 * legacy placeholders like "n/a" count as missing.
 */
export function isValidPhone(value: string | null | undefined): boolean {
	return normalizePhone(value) !== null;
}

export const PHONE_REQUIRED_MESSAGE =
	'A phone number is required so staff can reach you about your booking.';
