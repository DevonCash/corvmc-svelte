/**
 * CSS Sanitizer for user-authored band page styles.
 *
 * Strips dangerous patterns while preserving valid CSS declarations.
 * All user CSS is rendered inside a <style> scoped to `.band-site-container`,
 * so it cannot leak outside the band page.
 *
 * Blocked patterns:
 * - @import (prevents loading external stylesheets)
 * - @charset (unnecessary, can cause issues)
 * - url() with external domains (prevents data exfiltration / external loads)
 * - expression() (IE legacy scripting)
 * - javascript: protocol
 * - -moz-binding (Firefox XBL)
 * - behavior: (IE HTC)
 * - Base64-encoded scripts in url()
 */

const MAX_CSS_LENGTH = 51200; // 50KB

/** Patterns to strip entirely (including surrounding declaration) */
const BLOCKED_AT_RULES = /@import\b[^;]*;?/gi;
const BLOCKED_CHARSET = /@charset\b[^;]*;?/gi;

/** Dangerous value patterns */
const DANGEROUS_PATTERNS = [
	/expression\s*\(/gi,
	/javascript\s*:/gi,
	/-moz-binding\s*:/gi,
	/behavior\s*:\s*url/gi,
	/\/\*[\s\S]*?\*\//g // strip comments (can hide injection)
];

/** url() with external domains — allow data: for small inline images, and relative paths */
const EXTERNAL_URL_PATTERN = /url\s*\(\s*(['"]?)\s*(https?:\/\/|\/\/)[^)]*\1\s*\)/gi;

/** Dangerous data URIs (scripts disguised as data) */
const DANGEROUS_DATA_URI =
	/url\s*\(\s*(['"]?)\s*data\s*:\s*(text\/html|application\/javascript|text\/javascript)[^)]*\)/gi;

export interface SanitizeResult {
	css: string;
	warnings: string[];
}

/**
 * Sanitize user-provided CSS string.
 * Returns cleaned CSS and any warnings about removed content.
 */
export function sanitizeCss(input: string): SanitizeResult {
	const warnings: string[] = [];

	if (!input || input.trim().length === 0) {
		return { css: '', warnings };
	}

	// Enforce size limit
	if (input.length > MAX_CSS_LENGTH) {
		warnings.push(`CSS exceeds ${MAX_CSS_LENGTH / 1024}KB limit, truncated`);
		input = input.slice(0, MAX_CSS_LENGTH);
	}

	let css = input;

	// Strip @import
	if (BLOCKED_AT_RULES.test(css)) {
		warnings.push('@import rules removed (external stylesheets not allowed)');
		css = css.replace(BLOCKED_AT_RULES, '');
	}

	// Strip @charset
	if (BLOCKED_CHARSET.test(css)) {
		css = css.replace(BLOCKED_CHARSET, '');
	}

	// Strip comments (can hide injections)
	css = css.replace(/\/\*[\s\S]*?\*\//g, '');

	// Strip external URLs
	if (EXTERNAL_URL_PATTERN.test(css)) {
		warnings.push('External url() references removed');
		css = css.replace(EXTERNAL_URL_PATTERN, 'url("")');
	}

	// Strip dangerous data URIs
	if (DANGEROUS_DATA_URI.test(css)) {
		warnings.push('Dangerous data: URIs removed');
		css = css.replace(DANGEROUS_DATA_URI, 'url("")');
	}

	// Strip dangerous value patterns
	for (const pattern of DANGEROUS_PATTERNS) {
		if (pattern.test(css)) {
			const name = pattern.source.split('\\')[0] || 'dangerous pattern';
			warnings.push(`Blocked pattern removed: ${name}`);
			css = css.replace(pattern, '/* blocked */');
		}
	}

	// Clean up excessive whitespace
	css = css.replace(/\n{3,}/g, '\n\n').trim();

	return { css, warnings };
}

/**
 * Quick check if CSS contains any blocked patterns.
 * Useful for client-side preview warnings.
 */
export function hasBlockedPatterns(input: string): boolean {
	if (!input) return false;
	return (
		BLOCKED_AT_RULES.test(input) ||
		EXTERNAL_URL_PATTERN.test(input) ||
		DANGEROUS_DATA_URI.test(input) ||
		DANGEROUS_PATTERNS.some((p) => p.test(input))
	);
}
