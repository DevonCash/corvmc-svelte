import { describe, it, expect } from 'vitest';
import { renderCampaignPreview, renderCampaignForSend } from './campaign-render';

const MARKDOWN = '# Real Book Club\n\nFirst Thursday of the month. **Bring a chart.**';

describe('renderCampaignForSend', () => {
	const html = renderCampaignForSend(MARKDOWN, 'Maya', 'https://corvmc.org/unsub?t=abc');

	it('wraps the content in the branded shell', () => {
		// Tri-stripe in order, logo, and the 501(c)(3) footer line.
		expect(html).toMatch(/#00859b[\s\S]*#ffb500[\s\S]*#f84d13/);
		expect(html).toContain('https://corvmc.org/email/cmc-speaker.png');
		expect(html).toContain('501(c)(3)');
	});

	it('renders the markdown body', () => {
		expect(html).toContain('Real Book Club');
		expect(html).toContain('<strong>Bring a chart.</strong>');
	});

	it('leaves no unsubstituted layout placeholders', () => {
		expect(html).not.toContain('{{CONTENT}}');
		expect(html).not.toContain('{{PREVIEW_TEXT}}');
		expect(html).not.toContain('{{FOOTER}}');
	});

	it('substitutes the unsubscribe url into the footer', () => {
		expect(html).toContain('https://corvmc.org/unsub?t=abc');
	});

	it('populates the preheader', () => {
		const preheader = html.match(/mso-hide:all[^>]*>([^<]*)</)?.[1] ?? '';
		expect(preheader.trim()).not.toBe('');
	});

	it('escapes a hostile subscriber name', () => {
		const hostile = renderCampaignForSend(
			'Hello {{subscriber_name}}',
			'<script>alert(1)</script>',
			'https://corvmc.org/unsub'
		);
		expect(hostile).not.toContain('<script>alert(1)</script>');
		expect(hostile).toContain('&lt;script&gt;');
	});
});

describe('renderCampaignPreview', () => {
	it('fills template variables with placeholders rather than leaving them raw', () => {
		const html = renderCampaignPreview('Hi {{subscriber_name}}, see {{unsubscribe_url}}');
		expect(html).toContain('Hi there');
		expect(html).not.toContain('{{subscriber_name}}');
		expect(html).not.toContain('{{unsubscribe_url}}');
	});
});
