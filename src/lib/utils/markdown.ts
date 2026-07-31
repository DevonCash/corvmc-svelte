import { Marked } from 'marked';
// Default-import + destructure: `xss` is CJS, and Vite's SSR module runner
// can't statically resolve all of its named exports.
import xssModule from 'xss';

const { FilterXSS, getDefaultWhiteList } = xssModule as unknown as typeof import('xss');

// Sanitization uses js-xss, a pure-JS allowlist sanitizer that needs no DOM.
// (The previous DOMPurify + linkedom setup silently no-opped: DOMPurify
// requires a real DOM implementation and returns input UNCHANGED when it
// detects an unsupported environment — linkedom is one. jsdom-based options
// crash on the Cloudflare Workers runtime, so a parser-based sanitizer it is.)

function extendedWhiteList() {
	const wl = getDefaultWhiteList();
	// marked emits ids on headings (for the help TOC) and target/rel on links
	for (const h of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) wl[h] = [...(wl[h] ?? []), 'id'];
	wl.a = [...(wl.a ?? []), 'rel'];
	// fenced code blocks carry language-* classes
	wl.code = [...(wl.code ?? []), 'class'];
	wl.pre = [...(wl.pre ?? []), 'class'];
	// inline styles pass through js-xss's CSS filter (safe properties only)
	for (const tag of ['div', 'span', 'p', 'section', 'blockquote', 'figure', 'td', 'th']) {
		wl[tag] = [...(wl[tag] ?? []), 'style'];
	}
	// class is safe everywhere (band sites target it from sanitized custom CSS)
	for (const tag of Object.keys(wl)) {
		wl[tag] = [...(wl[tag] ?? []), 'class'];
	}
	return wl;
}

const htmlFilter = new FilterXSS({
	whiteList: extendedWhiteList(),
	stripIgnoreTag: true,
	stripIgnoreTagBody: ['script', 'style']
});

const bioFilter = new FilterXSS({
	whiteList: {
		p: [],
		br: [],
		strong: [],
		em: [],
		u: [],
		s: [],
		a: ['href', 'target', 'rel'],
		ul: [],
		ol: [],
		li: [],
		h3: ['id'],
		h4: ['id'],
		blockquote: []
	},
	stripIgnoreTag: true,
	stripIgnoreTagBody: ['script', 'style']
});

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
	return htmlFilter.process(html);
}

/**
 * Sanitize user-authored bio HTML (from the rich-text editor) with a tight
 * allowlist — only basic inline/block formatting and links.
 */
export function sanitizeBio(html: string | null | undefined): string {
	if (!html) return '';
	return bioFilter.process(html);
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
