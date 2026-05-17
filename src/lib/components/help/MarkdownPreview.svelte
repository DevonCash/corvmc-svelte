<script lang="ts">
	import { renderMarkdown } from '$lib/utils/markdown';

	let { content }: { content: string } = $props();

	let html = $derived(renderMarkdown(content));
</script>

<div class="prose prose-sm max-w-none">
	{@html html}
</div>
