<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button as BitsButton, Tooltip } from 'bits-ui';
	import { IconCheck, IconX } from '@tabler/icons-svelte';
	import { useShortcut, shortcutLabel } from '$lib/useShortcut.svelte';

	type Status = 'idle' | 'pending' | 'success' | 'error';

	let {
		href,
		label,
		title,
		icon,
		shortcut,
		status = 'idle',
		successLabel = 'Done',
		errorLabel = 'Error',
		disabled = false,
		class: className = 'btn-primary',
		children,
		...rest
	}: {
		href?: string;
		label?: string;
		title?: string;
		icon?: Snippet;
		shortcut?: string;
		status?: Status;
		successLabel?: string;
		errorLabel?: string;
		disabled?: boolean;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	} = $props();

	let keys = useShortcut(
		() => shortcut,
		() => {
			if (!disabled && status !== 'pending') {
				(rest.onclick as (() => void) | undefined)?.();
			}
		}
	);

	let statusClass = $derived(
		status === 'success' ? 'btn-success' : status === 'error' ? 'btn-error' : ''
	);
</script>

{#snippet buttonContent()}
	{#if children}
		{@render children()}
	{:else if status === 'pending'}
		<span class="loading loading-sm loading-spinner"></span>
		{label}
	{:else if status === 'success'}
		<IconCheck size={20} />
		{successLabel}
	{:else if status === 'error'}
		<IconX size={20} />
		{errorLabel}
	{:else}
		{#if keys.modHeld && keys.parsed}
			<kbd class="kbd kbd-sm text-base-content">{shortcutLabel(keys.parsed)}</kbd>
		{:else if icon}
			{@render icon()}
		{/if}
		{label}
	{/if}
{/snippet}

{#if title}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<BitsButton.Root
					{...props}
					{href}
					{disabled}
					class="btn {statusClass || className}"
					{...rest}
				>
					{@render buttonContent()}
				</BitsButton.Root>
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
{:else}
	<BitsButton.Root {href} {disabled} class="btn {statusClass || className}" {...rest}>
		{@render buttonContent()}
	</BitsButton.Root>
{/if}
