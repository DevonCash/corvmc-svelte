/**
 * Client-side browsing helpers for the directory pages.
 *
 * The public directory loads every public member and band in one unfiltered
 * `getPublicDirectory({})` call, so searching and faceting happen in the browser
 * rather than round-tripping the server filters that back `/member/directory`.
 * At the collective's scale that is the better trade — filtering is instant, no
 * keystroke hits the network, and the genre facets fall out of the loaded rows
 * for free.
 *
 * If the public directory ever outgrows a single payload, the replacement
 * already exists: pass filters to `getPublicDirectory` (its schema and the
 * `listPublicMembers`/`listPublicBands` conditions already handle search,
 * instruments, genres and the availability flags) and delete this module's use
 * from the public page. That switch also needs a debounce and public variants
 * of `getInstrumentSuggestions`/`getGenreSuggestions`, which are `requireUser()`
 * gated today.
 */

/** Vinyl-label colours for band cards, indexed by `hashIndex(band.id, …)`. */
export const BAND_COLORS = ['#e5771e', '#003b5c', '#00859b', '#f84d13', '#ffb500', '#5a3d2b'];

/**
 * Name match, mirroring the server's `name LIKE %q%` so the public and
 * members-only directories agree on what a search means.
 */
export function matchesSearch(row: { name: string }, q: string): boolean {
	const needle = q.trim().toLowerCase();
	if (!needle) return true;
	return row.name.toLowerCase().includes(needle);
}

/**
 * Distinct genres across `rows`, most common first, ties broken alphabetically.
 *
 * Callers pass the set filtered by everything *except* genre, so every chip
 * offered leads somewhere — a chip that would return nothing is never shown.
 */
export function genreFacets(rows: { genres?: string[] }[], limit = 12): string[] {
	const counts = new Map<string, number>();
	for (const row of rows) {
		// Distinct per row: a duplicated tag on one profile shouldn't outrank a
		// genre that genuinely appears on two.
		for (const genre of new Set(row.genres ?? [])) {
			counts.set(genre, (counts.get(genre) ?? 0) + 1);
		}
	}

	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, limit)
		.map(([genre]) => genre);
}

/** Whether `row` carries `genre`. An empty `genre` selects everything. */
export function matchesGenre(row: { genres?: string[] }, genre: string): boolean {
	if (!genre) return true;
	return (row.genres ?? []).includes(genre);
}
