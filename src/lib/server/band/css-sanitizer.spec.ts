import { describe, it, expect } from 'vitest';
import { sanitizeCss, hasBlockedPatterns } from './css-sanitizer';

describe('sanitizeCss', () => {
	it('passes through valid CSS unchanged', () => {
		const input = `.band-site-container { color: red; font-size: 16px; }`;
		const { css, warnings } = sanitizeCss(input);
		expect(css).toBe(input);
		expect(warnings).toHaveLength(0);
	});

	it('strips @import rules', () => {
		const input = `@import url("https://evil.com/steal.css");\n.foo { color: red; }`;
		const { css, warnings } = sanitizeCss(input);
		expect(css).not.toContain('@import');
		expect(css).toContain('.foo { color: red; }');
		expect(warnings.some((w) => w.includes('@import'))).toBe(true);
	});

	it('strips @charset rules', () => {
		const input = `@charset "UTF-8";\n.foo { color: red; }`;
		const { css } = sanitizeCss(input);
		expect(css).not.toContain('@charset');
		expect(css).toContain('.foo { color: red; }');
	});

	it('strips external url() references', () => {
		const input = `.foo { background: url("https://evil.com/tracker.png"); }`;
		const { css, warnings } = sanitizeCss(input);
		expect(css).not.toContain('evil.com');
		expect(css).toContain('url("")');
		expect(warnings.some((w) => w.includes('External url()'))).toBe(true);
	});

	it('allows relative url() references', () => {
		const input = `.foo { background: url("/images/bg.png"); }`;
		const { css, warnings } = sanitizeCss(input);
		expect(css).toContain('/images/bg.png');
		expect(warnings).toHaveLength(0);
	});

	it('allows data: URIs for images', () => {
		const input = `.foo { background: url("data:image/png;base64,abc123"); }`;
		const { css, warnings } = sanitizeCss(input);
		expect(css).toContain('data:image/png');
		expect(warnings).toHaveLength(0);
	});

	it('strips dangerous data: URIs (text/html)', () => {
		const input = `.foo { background: url("data:text/html,<script>alert(1)</script>"); }`;
		const { css, warnings } = sanitizeCss(input);
		expect(css).not.toContain('text/html');
		expect(warnings.some((w) => w.includes('data: URI'))).toBe(true);
	});

	it('strips expression()', () => {
		const input = `.foo { width: expression(document.body.clientWidth); }`;
		const { css } = sanitizeCss(input);
		expect(css).not.toContain('expression');
		expect(css).toContain('/* blocked */');
	});

	it('strips javascript: protocol', () => {
		const input = `.foo { background: url("javascript:alert(1)"); }`;
		const { css } = sanitizeCss(input);
		expect(css).not.toContain('javascript');
	});

	it('strips -moz-binding', () => {
		const input = `.foo { -moz-binding: url("evil.xml#xbl"); }`;
		const { css } = sanitizeCss(input);
		expect(css).not.toContain('-moz-binding');
	});

	it('strips CSS comments', () => {
		const input = `.foo { /* hidden injection */ color: red; }`;
		const { css } = sanitizeCss(input);
		expect(css).not.toContain('/*');
		expect(css).toContain('color: red');
	});

	it('truncates CSS exceeding 50KB', () => {
		const input = 'a'.repeat(60000);
		const { css, warnings } = sanitizeCss(input);
		expect(css.length).toBeLessThanOrEqual(51200);
		expect(warnings.some((w) => w.includes('50KB'))).toBe(true);
	});

	it('returns empty string for empty input', () => {
		expect(sanitizeCss('').css).toBe('');
		expect(sanitizeCss('   ').css).toBe('');
	});
});

describe('hasBlockedPatterns', () => {
	it('returns true for @import', () => {
		expect(hasBlockedPatterns('@import url("x");')).toBe(true);
	});

	it('returns true for expression()', () => {
		expect(hasBlockedPatterns('width: expression(1)')).toBe(true);
	});

	it('returns false for clean CSS', () => {
		expect(hasBlockedPatterns('.foo { color: red; }')).toBe(false);
	});

	it('returns false for empty input', () => {
		expect(hasBlockedPatterns('')).toBe(false);
	});
});
