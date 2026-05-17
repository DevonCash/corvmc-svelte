import { Marked } from 'marked';

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

export function renderMarkdown(content: string): string {
	return marked.parse(content) as string;
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
