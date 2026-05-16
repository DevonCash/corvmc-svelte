<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button as BitsButton } from 'bits-ui';
	import { IconCheck, IconX } from '@tabler/icons-svelte';
	import { useShortcut, shortcutLabel } from '$lib/useShortcut.svelte';

	type Status = 'idle' | 'pending' | 'success' | 'error';

	let {
		href,
		label,
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

<BitsButton.Root
	{href}
	{disabled}
	class="btn {statusClass || className}"
	{...rest}
>
	{#if children}
		{@render children()}
	{:else if status === 'pending'}
		<span class="loading loading-spinner loading-sm"></span>
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
</BitsButton.Root>
