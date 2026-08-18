/**
 * Driver-error predicates. Kept free of schema imports so specs that mock
 * `drizzle-orm` can use the real implementations.
 */

/**
 * Matches D1/SQLite unique-violation text on the error or its wrapped cause.
 *
 * D1 raises "UNIQUE constraint failed: ...", and drizzle wraps it in a
 * DrizzleQueryError whose own message is the SQL, keeping the driver text in
 * `cause`. A case-sensitive check for lowercase 'unique' on the outer message
 * matched neither, which let a raw D1_ERROR escape as a 500
 * (JAVASCRIPT-SVELTEKIT-2D).
 */
export function isUniqueConstraintError(err: unknown): boolean {
	for (let current: unknown = err, depth = 0; current instanceof Error && depth < 4; depth++) {
		if (/unique constraint/i.test(current.message)) return true;
		current = (current as { cause?: unknown }).cause;
	}
	return false;
}
