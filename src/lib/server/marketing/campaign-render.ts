import { marked } from 'marked';
import mjml2html from 'mjml';

// ---------------------------------------------------------------------------
// Campaign email rendering
// ---------------------------------------------------------------------------
// Markdown → HTML → MJML → responsive email HTML.
// Uses the same brand styling as transactional emails but with a
// campaign-specific footer containing the unsubscribe link.
// ---------------------------------------------------------------------------

/**
 * Build the MJML source for a campaign email.
 * The content is already-rendered HTML from markdown.
 */
function buildMjml(
	htmlContent: string,
	previewText: string,
	footerHtml: string
): string {
	return `
<mjml>
  <mj-head>
    <mj-preview>${previewText}</mj-preview>
    <mj-attributes>
      <mj-all font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" />
      <mj-text font-size="15px" line-height="1.6" color="#374151" />
      <mj-button background-color="#6366f1" border-radius="6px" font-size="15px" font-weight="600" />
    </mj-attributes>
    <mj-style>
      .footer-text { font-size: 12px; color: #9ca3af; }
      a { color: #6366f1; }
    </mj-style>
  </mj-head>
  <mj-body background-color="#f3f4f6">
    <mj-section padding="20px 0 0">
      <mj-column>
        <mj-text align="center" font-size="22px" font-weight="700" color="#111827">
          CorvMC
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="#ffffff" border-radius="8px" padding="32px 24px">
      <mj-column>
        <mj-text>${htmlContent}</mj-text>
      </mj-column>
    </mj-section>

    <mj-section padding="16px 0">
      <mj-column>
        <mj-text align="center" css-class="footer-text">
          ${footerHtml}
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;
}

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

/**
 * Render a campaign for live preview in the editor.
 * Uses placeholder values for template variables.
 */
export function renderCampaignPreview(markdown: string): string {
	let html = markdownToHtml(markdown);

	// Replace template variables with preview placeholders
	html = html.replaceAll('{{subscriber_name}}', 'there');
	html = html.replaceAll('{{unsubscribe_url}}', '#');

	const previewText = markdown.slice(0, 100).replace(/[#*_\n]/g, '').trim();
	const footerHtml = '<a href="#">Unsubscribe from this list</a>';

	const mjmlSource = buildMjml(html, previewText, footerHtml);
	const result = mjml2html(mjmlSource, { validationLevel: 'soft', minify: false });

	if (result.errors.length > 0) {
		console.warn('[campaign-render] MJML preview warnings:', result.errors);
	}

	return result.html;
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

	const previewText = markdown.slice(0, 100).replace(/[#*_\n]/g, '').trim();
	const footerHtml = `<a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe from this list</a>`;

	const mjmlSource = buildMjml(html, previewText, footerHtml);
	const result = mjml2html(mjmlSource, { validationLevel: 'soft', minify: true });

	if (result.errors.length > 0) {
		console.warn('[campaign-render] MJML send warnings:', result.errors);
	}

	return result.html;
}
