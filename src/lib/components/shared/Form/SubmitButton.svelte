<script lang="ts">
	import type { Snippet } from 'svelte';
	import { IconCheck, IconX } from '@tabler/icons-svelte';
	import { getFormContext } from './Form.svelte';
	import { useShortcut, shortcutLabel } from '$lib/useShortcut.svelte';

	let {
		shortcut,
		icon,
		label = 'Save',
		successLabel = 'Saved',
		errorLabel = 'Error',
		class: className = 'btn-primary',
		disabled = false,
		...rest
	}: {
		shortcut?: string;
		icon?: Snippet;
		label?: string;
		successLabel?: string;
		errorLabel?: string;
		class?: string;
		disabled?: boolean;
		[key: string]: unknown;
	} = $props();

	let ctx = getFormContext();

	let keys = useShortcut(() => shortcut, () => {
		if (ctx.status !== 'pending' && !disabled) ctx.submit();
	});
</script>

<button
	type="submit"
	class="btn {className}"
	class:btn-success={ctx.status === 'success'}
	class:btn-error={ctx.status === 'error'}
	disabled={disabled || ctx.status !== 'dirty'}
	{...rest}
>
	{#if ctx.status === 'pending'}
		<span class="loading loading-spinner loading-sm"></span>
		{label}
	{:else if ctx.status === 'success'}
		<IconCheck size={20} />
		{successLabel}
	{:else if ctx.status === 'error'}
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
</button>
