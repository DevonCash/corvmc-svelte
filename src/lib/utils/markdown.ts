import { Marked } from 'marked';
import createDOMPurify, { type DOMPurify as DOMPurifyInstance } from 'dompurify';
import { parseHTML } from 'linkedom';

// `isomorphic-dompurify` bundles jsdom, which throws at import time on the
// Cloudflare Workers runtime (no DOM globals) and crashed the whole worker.
// Drive plain DOMPurify with linkedom's Workers-compatible DOM instead, and
// initialise lazily so merely importing this module never touches the DOM.
let _purify: DOMPurifyInstance | undefined;
function purify(): DOMPurifyInstance {
	if (!_purify) {
		const { window } = parseHTML('<!DOCTYPE html><html><body></body></html>');
		_purify = createDOMPurify(window as unknown as Window & typeof globalThis);
	}
	return _purify;
}

export interface Heading {
	id: string;
	text: string;
	level: number;
}

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.trim();
}

const renderer = {
	heading({ tokens, depth }: { tokens: { raw: string }[]; depth: number }) {
		const text = tokens.map((t) => t.raw).join('');
		const id = slugify(text);
		return `<h${depth} id="${id}">${text}</h${depth}>`;
	},
	link({ href, text }: { href: string; text: string }) {
		const isInternal = href.startsWith('/member/help/') || href.startsWith('./');
		const attrs = isInternal ? '' : ' target="_blank" rel="noopener noreferrer"';
		return `<a href="${href}"${attrs}>${text}</a>`;
	}
};

const marked = new Marked({ renderer });

export function sanitizeHtml(html: string): string {
	return purify().sanitize(html);
}

/**
 * Sanitize user-authored bio HTML (from the rich-text editor) with a tight
 * allowlist — only basic inline/block formatting and links.
 */
export function sanitizeBio(html: string | null | undefined): string {
	if (!html) return '';
	return purify().sanitize(html, {
		ALLOWED_TAGS: [
			'p',
			'br',
			'strong',
			'em',
			'u',
			's',
			'a',
			'ul',
			'ol',
			'li',
			'h3',
			'h4',
			'blockquote'
		],
		ALLOWED_ATTR: ['href', 'target', 'rel']
	});
}

export function renderMarkdown(content: string): string {
	return sanitizeHtml(marked.parse(content) as string);
}

export function extractHeadings(content: string): Heading[] {
	const headings: Heading[] = [];
	const tokens = marked.lexer(content);

	for (const token of tokens) {
		if (token.type === 'heading') {
			headings.push({
				id: slugify(token.text),
				text: token.text,
				level: token.depth
			});
		}
	}

	return headings;
}
