/** Escape a plain string for interpolation into HTML text or an attribute value. */
export function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Escape a plain string and preserve its line breaks as `<br />`.
 *
 * For user-generated text rendered into email, where `white-space: pre-wrap`
 * is unreliable (Word-engine Outlook ignores it and collapses the whole
 * message onto one line).
 */
export function escapeHtmlWithBreaks(str: string): string {
	return escapeHtml(str).replace(/\r?\n/g, '<br />');
}
