export const patterns = [
	'rays',
	'stripes',
	'checker',
	'halftone',
	'blobs',
	'zigzag',
	'diamonds',
	'waves',
	'cross',
	'triangles',
	'scales',
	'dots-lg',
	'grid-thick',
	'houndstooth',
	'concentric',
	'horizon',
	'argyle',
	'bricks',
	'polka'
] as const;

export const darkTextPatterns = new Set([
	'checker',
	'halftone',
	'blobs',
	'cross',
	'triangles',
	'houndstooth',
	'diamonds'
]);

/**
 * Stable index into a list of `length` items, derived from `text`.
 *
 * The point is that the same input always lands on the same slot: picking by
 * array position instead means every item's choice reshuffles as soon as the
 * list is filtered or reordered.
 */
export function hashIndex(text: string, length: number): number {
	if (length <= 0) return 0;
	let hash = 0;
	for (let i = 0; i < text.length; i++) {
		hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
	}
	return Math.abs(hash) % length;
}

export function hashPattern(text: string): (typeof patterns)[number] {
	return patterns[hashIndex(text, patterns.length)];
}
