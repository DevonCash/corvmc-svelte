export const patterns = [
	'rays', 'stripes', 'checker', 'halftone', 'blobs',
	'zigzag', 'diamonds', 'waves', 'cross', 'triangles',
	'scales', 'dots-lg', 'grid-thick', 'houndstooth', 'concentric',
	'horizon', 'argyle', 'bricks', 'polka'
] as const;

export const darkTextPatterns = new Set([
	'checker', 'halftone', 'blobs', 'cross', 'triangles', 'houndstooth', 'diamonds'
]);

export function hashPattern(text: string): typeof patterns[number] {
	let hash = 0;
	for (let i = 0; i < text.length; i++) {
		hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
	}
	return patterns[Math.abs(hash) % patterns.length];
}
