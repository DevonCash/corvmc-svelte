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
 * Parse a user-entered dollar amount into whole cents.
 *
 * Returns `null` for anything that is not a usable price — empty, blank,
 * non-numeric, or negative. Callers that require a price should treat `null` as
 * a validation failure rather than substituting a default; a silent 0 would
 * publish a free show.
 *
 * Deliberately imposes no upper bound. An earlier version capped this at
 * $1,000, which silently broke a price staff could previously save: the value
 * became `null`, the hidden cents field submitted empty, and the save died as a
 * thrown "Ticket price is required" with the amount still visible in the form.
 * A ceiling is only safe alongside a `max` on the input and a field-level
 * validation message.
 */
export function dollarsToCents(dollars: string | number | null | undefined): number | null {
	if (dollars == null) return null;

	const raw = typeof dollars === 'number' ? dollars : dollars.trim();
	if (raw === '') return null;

	const parsed = typeof raw === 'number' ? raw : Number(raw);
	if (!Number.isFinite(parsed) || parsed < 0) return null;

	// `parseFloat('15.10') * 100` is 1509.9999999999998, so the rounding is
	// load-bearing rather than cosmetic.
	return Math.round(parsed * 100);
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
