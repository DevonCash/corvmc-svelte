<script lang="ts">
	import { Dialog } from 'bits-ui';
	import type { Snippet } from 'svelte';

	let {
		open = $bindable(false),
		title,
		maxWidth = 'max-w-lg',
		titleSnippet,
		children,
		onclose
	}: {
		open?: boolean;
		title?: string;
		maxWidth?: string;
		titleSnippet?: Snippet;
		children: Snippet;
		onclose?: () => void;
	} = $props();

	function handleOpenChange(next: boolean) {
		open = next;
		if (!next) onclose?.();
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay class="modal modal-open bg-black/40" />
		<Dialog.Content class="modal modal-open">
			<div class="modal-box {maxWidth}">
				<div class="flex items-center justify-between mb-4">
					{#if titleSnippet}
						{@render titleSnippet()}
					{:else if title}
						<Dialog.Title class="text-lg font-bold">{title}</Dialog.Title>
					{/if}
					<Dialog.Close class="btn btn-sm btn-outline btn-circle">✕</Dialog.Close>
				</div>

				{@render children()}
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
