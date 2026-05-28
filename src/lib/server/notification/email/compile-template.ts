import { TRANSACTIONAL_LAYOUT } from '$lib/server/generated/email-layout-transactional';

// ---------------------------------------------------------------------------
// Email template compiler (build-time pre-compiled layout)
// ---------------------------------------------------------------------------
// The MJML layout is compiled at build time by scripts/compile-email-layouts.ts.
// At runtime we only do variable substitution and content injection — no MJML
// dependency needed.
// ---------------------------------------------------------------------------

/**
 * Compile an email from pre-built HTML table rows and variable values.
 *
 * @param contentRows - HTML `<tr>` elements built with helpers from html-helpers.ts
 * @param previewText - Short preview text shown in email clients
 * @param variables - Key/value pairs to replace `{{key}}` placeholders
 */
export function compileEmail(
	contentRows: string,
	previewText: string,
	variables: Record<string, string> = {}
): string {
	let html = TRANSACTIONAL_LAYOUT.replace('{{CONTENT}}', contentRows).replace(
		'{{PREVIEW_TEXT}}',
		escapeHtml(previewText)
	);

	for (const [key, value] of Object.entries(variables)) {
		html = html.replaceAll(`{{${key}}}`, escapeHtml(value));
	}

	return html;
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}
