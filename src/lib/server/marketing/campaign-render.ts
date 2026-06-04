import { marked } from 'marked';
import { CAMPAIGN_LAYOUT } from '$lib/server/generated/email-layout-campaign';

// ---------------------------------------------------------------------------
// Campaign email rendering
// ---------------------------------------------------------------------------
// Markdown → HTML → injected into pre-compiled MJML layout.
// The MJML layout is compiled at build time by scripts/compile-email-layouts.ts.
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function markdownToHtml(markdown: string): string {
	return marked.parse(markdown, { async: false }) as string;
}

function renderWithLayout(htmlContent: string, previewText: string, footerHtml: string): string {
	return CAMPAIGN_LAYOUT.replace('{{CONTENT}}', htmlContent)
		.replace('{{PREVIEW_TEXT}}', escapeHtml(previewText))
		.replace('{{FOOTER}}', footerHtml);
}

/**
 * Render a campaign for live preview in the editor.
 * Uses placeholder values for template variables.
 */
export function renderCampaignPreview(markdown: string): string {
	let html = markdownToHtml(markdown);

	// Replace template variables with preview placeholders
	html = html.replaceAll('{{subscriber_name}}', 'there');
	html = html.replaceAll('{{unsubscribe_url}}', '#');

	const previewText = markdown
		.slice(0, 100)
		.replace(/[#*_\n]/g, '')
		.trim();
	const footerHtml = '<a href="#">Unsubscribe from this list</a>';

	return renderWithLayout(html, previewText, footerHtml);
}

/**
 * Render a campaign for actual sending to a specific recipient.
 */
export function renderCampaignForSend(
	markdown: string,
	subscriberName: string | null,
	unsubscribeUrl: string
): string {
	let html = markdownToHtml(markdown);

	// Replace template variables with real values
	html = html.replaceAll('{{subscriber_name}}', escapeHtml(subscriberName || 'there'));
	html = html.replaceAll('{{unsubscribe_url}}', escapeHtml(unsubscribeUrl));

	const previewText = markdown
		.slice(0, 100)
		.replace(/[#*_\n]/g, '')
		.trim();
	const footerHtml = `<a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe from this list</a>`;

	return renderWithLayout(html, previewText, footerHtml);
}
