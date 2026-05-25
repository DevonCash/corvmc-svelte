<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button as BitsButton, Tooltip } from 'bits-ui';
	import { IconCheck, IconX } from '@tabler/icons-svelte';
	import { useShortcut, shortcutLabel } from '$lib/useShortcut.svelte';
	import clsx from 'clsx';

	type Status = 'idle' | 'pending' | 'success' | 'error';

	let {
		href,
		type,
		title,
		disabled = false,
		class: className = 'btn-primary',
		children,
		...rest
	}: {
		href?: string;
		type?: 'button' | 'submit' | 'reset';
		title?: string;
		disabled?: boolean;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	} = $props();
</script>

{#snippet renderButton()}
	<BitsButton.Root {href} {disabled} class={clsx('btn', className)} {...rest}>
		{@render children?.()}
	</BitsButton.Root>
{/snippet}

{#if !title}
	{@render renderButton()}
{:else}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{@render renderButton()}
		</Tooltip.Trigger>
		<Tooltip.Portal>
			<Tooltip.Content
				side="bottom"
				sideOffset={4}
				class="z-50 rounded bg-neutral px-2 py-1 text-xs text-neutral-content shadow-lg"
			>
				{title}
			</Tooltip.Content>
		</Tooltip.Portal>
	</Tooltip.Root>
{/if}
