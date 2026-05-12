<script lang="ts">
	import type { Snippet } from 'svelte';
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
	disabled={disabled || ctx.status === 'pending'}
	{...rest}
>
	{#if ctx.status === 'pending'}
		<span class="loading loading-spinner loading-sm"></span>
		{label}
	{:else if ctx.status === 'success'}
		<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
			<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
		</svg>
		{successLabel}
	{:else if ctx.status === 'error'}
		<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
			<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
		</svg>
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
