import { describe, it, expect } from 'vitest';
import { pageWindow, pageRange, PAGE_GAP } from './pagination';

describe('pageWindow', () => {
	it('lists every page when they all fit', () => {
		expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
	});

	it('handles a single page', () => {
		expect(pageWindow(1, 1)).toEqual([1]);
	});

	it('returns nothing when there are no pages', () => {
		expect(pageWindow(1, 0)).toEqual([]);
	});

	it('collapses the tail on an early page', () => {
		expect(pageWindow(1, 40)).toEqual([1, 2, PAGE_GAP, 40]);
	});

	it('collapses both sides in the middle', () => {
		expect(pageWindow(20, 40)).toEqual([1, PAGE_GAP, 19, 20, 21, PAGE_GAP, 40]);
	});

	it('collapses the head on the last page', () => {
		expect(pageWindow(40, 40)).toEqual([1, PAGE_GAP, 39, 40]);
	});

	it('renders a lone skipped page rather than an ellipsis', () => {
		// 1 … 3 4 5 … 7 would hide exactly one page on each side; showing 2 and 6
		// costs the same width and saves a click.
		expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
	});

	it('never emits two gaps in a row', () => {
		for (let page = 1; page <= 40; page++) {
			const items = pageWindow(page, 40);
			const doubled = items.some((item, i) => item === PAGE_GAP && items[i + 1] === PAGE_GAP);
			expect(doubled, `two adjacent gaps at page ${page}`).toBe(false);
		}
	});

	it('always includes the first, last, and current page', () => {
		for (let page = 1; page <= 40; page++) {
			expect(pageWindow(page, 40)).toEqual(expect.arrayContaining([1, page, 40]));
		}
	});

	it('clamps an out-of-range page', () => {
		expect(pageWindow(0, 5)).toEqual(pageWindow(1, 5));
		expect(pageWindow(99, 5)).toEqual(pageWindow(5, 5));
	});

	it('widens the window with a larger radius', () => {
		expect(pageWindow(20, 40, 2)).toEqual([1, PAGE_GAP, 18, 19, 20, 21, 22, PAGE_GAP, 40]);
	});
});

describe('pageRange', () => {
	it('describes a full first page', () => {
		expect(pageRange(1, 20, 137)).toEqual({ from: 1, to: 20 });
	});

	it('describes a middle page', () => {
		expect(pageRange(2, 20, 137)).toEqual({ from: 21, to: 40 });
	});

	it('clamps the last page to the total', () => {
		expect(pageRange(7, 20, 137)).toEqual({ from: 121, to: 137 });
	});

	it('handles a single partial page', () => {
		expect(pageRange(1, 20, 3)).toEqual({ from: 1, to: 3 });
	});

	it('returns null when there is nothing to show', () => {
		expect(pageRange(1, 20, 0)).toBeNull();
	});

	it('returns null past the end', () => {
		expect(pageRange(99, 20, 137)).toBeNull();
	});
});
