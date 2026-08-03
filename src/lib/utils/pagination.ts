/** A gap in the page sequence, rendered as an ellipsis. */
export const PAGE_GAP = 'gap' as const;

export type PageItem = number | typeof PAGE_GAP;

/**
 * Build a windowed page sequence: first page, last page, and `radius` pages
 * either side of the current one, with gaps collapsed to an ellipsis.
 *
 * A gap is only emitted when it hides more than one page — replacing a single
 * page with an ellipsis costs a click and saves nothing.
 */
export function pageWindow(page: number, totalPages: number, radius = 1): PageItem[] {
	if (totalPages <= 0) return [];

	const current = Math.min(Math.max(page, 1), totalPages);

	// The widest a windowed run can get is first + gap + (2·radius + 1) + gap +
	// last. Below that, windowing can only ever be narrower than the full list by
	// hiding pages it had room for — so just list them all.
	const widestWindow = 2 * radius + 5;
	if (totalPages <= widestWindow) {
		return Array.from({ length: totalPages }, (_, i) => i + 1);
	}

	const shown = new Set<number>([1, totalPages]);
	for (let p = current - radius; p <= current + radius; p++) {
		if (p >= 1 && p <= totalPages) shown.add(p);
	}

	const items: PageItem[] = [];
	let previous = 0;
	for (const p of [...shown].sort((a, b) => a - b)) {
		if (previous) {
			// One skipped page is cheaper to render than an ellipsis.
			if (p - previous === 2) items.push(previous + 1);
			else if (p - previous > 2) items.push(PAGE_GAP);
		}
		items.push(p);
		previous = p;
	}
	return items;
}

/**
 * The 1-based inclusive range of rows on the current page, for a
 * "Showing 21–40 of 137" line. Returns null when there is nothing to show.
 */
export function pageRange(
	page: number,
	pageSize: number,
	total: number
): { from: number; to: number } | null {
	if (total <= 0 || pageSize <= 0) return null;
	const from = (Math.max(page, 1) - 1) * pageSize + 1;
	if (from > total) return null;
	return { from, to: Math.min(from + pageSize - 1, total) };
}
