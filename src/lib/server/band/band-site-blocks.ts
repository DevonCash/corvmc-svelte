import type { Block } from '$lib/server/db/schema/band-page';
import { resolveImageUrl } from '$lib/server/storage';
import { sanitizeBio, sanitizeHtml } from '$lib/utils/markdown';

/**
 * Prepare stored page blocks for public rendering: resolve R2 image keys to
 * public URLs and sanitize user-authored HTML. The renderer must only ever see
 * the output of this transform — blocks at rest hold raw keys and raw HTML.
 */
export function prepareBlocksForRender(blocks: Block[]): Block[] {
	return blocks.map((block) => {
		switch (block.type) {
			case 'hero':
				return { ...block, imageKey: resolveImageUrl(block.imageKey) ?? '' };
			case 'bio':
				return { ...block, content: sanitizeBio(block.content) };
			case 'custom_html':
				return { ...block, content: sanitizeHtml(block.content) };
			case 'gallery':
				return {
					...block,
					imageKeys: block.imageKeys
						.map((key) => resolveImageUrl(key))
						.filter((url): url is string => url !== null)
				};
			case 'merch':
				return {
					...block,
					items: block.items.map((item) =>
						item.imageKey
							? { ...item, imageKey: resolveImageUrl(item.imageKey) ?? undefined }
							: item
					)
				};
			default:
				return block;
		}
	});
}
