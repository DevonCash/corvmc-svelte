/**
 * Ticket prices are entered in dollars and stored in whole cents. Both
 * conversions used to be written inline at each call site as
 * `Math.round(parseFloat(x) * 100)`, which silently produced `NaN` for an empty
 * or malformed field and then wrote it into a hidden form input.
 *
 * These helpers are the single place that crossing happens. They are pure and
 * carry no DB or Svelte dependency, so both the client (rendering a price back
 * into an input) and the server (parsing a submitted dollar amount) use them.
 */

/**
 * A sanity ceiling on a single ticket, well above anything the space sells but
 * low enough to catch a misplaced decimal ("1500" meant as $15.00).
 */
export const MAX_TICKET_PRICE_CENTS = 100_000;

/**
 * Parse a user-entered dollar amount into whole cents.
 *
 * Returns `null` for anything that is not a usable price — empty, blank,
 * non-numeric, negative, or beyond {@link MAX_TICKET_PRICE_CENTS}. Callers that
 * require a price should treat `null` as a validation failure rather than
 * substituting a default; a silent 0 would publish a free show.
 */
export function dollarsToCents(dollars: string | number | null | undefined): number | null {
	if (dollars == null) return null;

	const raw = typeof dollars === 'number' ? dollars : dollars.trim();
	if (raw === '') return null;

	const parsed = typeof raw === 'number' ? raw : Number(raw);
	if (!Number.isFinite(parsed) || parsed < 0) return null;

	// `parseFloat('15.10') * 100` is 1509.9999999999998, so the rounding is
	// load-bearing rather than cosmetic.
	const cents = Math.round(parsed * 100);
	if (cents > MAX_TICKET_PRICE_CENTS) return null;

	return cents;
}

/**
 * Render stored cents back into the dollar string a price input expects.
 * `null`/undefined becomes an empty string so an unpriced event leaves the
 * field blank instead of showing "0.00".
 */
export function centsToDollars(cents: number | null | undefined): string {
	if (cents == null || !Number.isFinite(cents)) return '';
	return (cents / 100).toFixed(2);
}
