<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button as BitsButton, Tooltip, mergeProps } from 'bits-ui';
	import clsx from 'clsx';

	let {
		href,
		title,
		disabled = false,
		class: className = 'btn-primary',
		children,
		...rest
	}: {
		href?: string;
		title?: string;
		disabled?: boolean;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	} = $props();
</script>

<!-- `triggerProps` are the tooltip trigger's props, merged onto the button itself.
     Rendering them on a wrapper element instead would nest a <button> inside a
     <button> (or an <a> inside a <button>), which drops the control out of the
     accessibility tree entirely. -->
{#snippet renderButton(triggerProps?: Record<string | symbol, unknown>)}
	<BitsButton.Root
		{...mergeProps(triggerProps ?? {}, rest, {
			href,
			disabled,
			class: clsx('btn', className)
		})}
	>
		{@render children?.()}
	</BitsButton.Root>
{/snippet}

{#if !title}
	{@render renderButton()}
{:else}
	<Tooltip.Root>
		<Tooltip.Trigger {disabled}>
			{#snippet child({ props })}
				{@render renderButton(props)}
			{/snippet}
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
