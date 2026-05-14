import mjml2html from 'mjml';

// ---------------------------------------------------------------------------
// MJML template compiler
// ---------------------------------------------------------------------------
// Wraps content in a shared base layout and compiles MJML to HTML.
// Templates use {{variable}} placeholders that are replaced before
// compilation. This keeps templates simple string functions.
// ---------------------------------------------------------------------------

const BASE_LAYOUT = (content: string, previewText: string) => `
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
        ${content}
      </mj-column>
    </mj-section>

    <mj-section padding="16px 0">
      <mj-column>
        <mj-text align="center" css-class="footer-text">
          You're receiving this because of your notification preferences.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`;

/**
 * Compile an MJML content block into a full HTML email.
 * The content should be MJML body elements (mj-text, mj-button, etc.)
 * without the outer mjml/mj-body wrapper.
 */
export function compileEmail(
	content: string,
	previewText: string,
	variables: Record<string, string> = {}
): string {
	// Replace {{variable}} placeholders
	let mjmlSource = BASE_LAYOUT(content, previewText);
	for (const [key, value] of Object.entries(variables)) {
		mjmlSource = mjmlSource.replaceAll(`{{${key}}}`, escapeHtml(value));
	}

	const result = mjml2html(mjmlSource, {
		validationLevel: 'soft',
		minify: true
	});

	if (result.errors.length > 0) {
		console.warn('[email] MJML compilation warnings:', result.errors);
	}

	return result.html;
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}
