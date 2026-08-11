import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let countResult = 0;

function chainable() {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				return (resolve: (v: unknown[]) => void) => resolve([{ count: countResult }]);
			}
			return () => proxy;
		}
	});
	return proxy;
}

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => chainable()
	}
}));

import { generateSlug, ensureUniqueSlug } from './slug';
import { band } from '$lib/server/db/schema/band';

describe('generateSlug', () => {
	// Slug generation never introduces a hyphen of its own — spaces collapse.
	it('lowercases and collapses spaces', () => {
		expect(generateSlug('My Cool Band')).toBe('mycoolband');
	});

	it('strips special characters without leaving a hyphen behind', () => {
		expect(generateSlug('Rock & Roll!!!')).toBe('rockroll');
	});

	it('keeps hyphens that were already in the name', () => {
		expect(generateSlug('Sun-Ra Arkestra')).toBe('sun-raarkestra');
	});

	it('collapses consecutive hyphens', () => {
		expect(generateSlug('a---b')).toBe('a-b');
	});

	it('trims leading and trailing hyphens', () => {
		expect(generateSlug('---hello---')).toBe('hello');
	});

	it('handles mixed unicode and punctuation', () => {
		expect(generateSlug("The Band's Name (Official)")).toBe('thebandsnameofficial');
	});

	it('handles single word', () => {
		expect(generateSlug('Radiohead')).toBe('radiohead');
	});

	it('handles empty string', () => {
		expect(generateSlug('')).toBe('');
	});
});

describe('ensureUniqueSlug', () => {
	beforeEach(() => {
		countResult = 0;
	});

	it('returns the slug as-is when no conflicts', async () => {
		countResult = 0;
		const result = await ensureUniqueSlug('my-band', band, band.slug);
		expect(result).toBe('my-band');
	});

	it('appends -2 when slug already exists', async () => {
		// First call returns 1 (exists), second returns 0 (available)
		let callCount = 0;
		vi.spyOn(await import('$lib/server/db'), 'db', 'get').mockReturnValue({
			select: () => {
				const proxy: any = new Proxy(() => proxy, {
					get(_, prop) {
						if (prop === 'then') {
							return (resolve: (v: unknown[]) => void) => {
								callCount++;
								resolve([{ count: callCount === 1 ? 1 : 0 }]);
							};
						}
						return () => proxy;
					}
				});
				return proxy;
			}
		} as any);

		const result = await ensureUniqueSlug('my-band', band, band.slug);
		expect(result).toBe('my-band-2');
	});
});
