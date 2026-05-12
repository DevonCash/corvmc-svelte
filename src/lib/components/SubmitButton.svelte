<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getFormContext } from './Form.svelte';
	import {
		parseShortcut,
		matchesShortcut,
		isModifierKey,
		shortcutLabel
	} from '$lib/shortcuts';

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
	let modHeld = $state(false);
	let buttonEl: HTMLButtonElement | undefined = $state();

	let parsed = $derived(shortcut ? parseShortcut(shortcut) : null);

	$effect(() => {
		if (!parsed) return;
		const p = parsed;

		function onKeydown(e: KeyboardEvent) {
			if (isModifierKey(e, p)) modHeld = true;
			if (matchesShortcut(e, p)) {
				e.preventDefault();
				if (!buttonEl?.disabled) {
					buttonEl?.closest('form')?.requestSubmit();
				}
			}
		}

		function onKeyup(e: KeyboardEvent) {
			if (isModifierKey(e, p)) modHeld = false;
		}

		function onBlur() {
			modHeld = false;
		}

		window.addEventListener('keydown', onKeydown);
		window.addEventListener('keyup', onKeyup);
		window.addEventListener('blur', onBlur);

		return () => {
			window.removeEventListener('keydown', onKeydown);
			window.removeEventListener('keyup', onKeyup);
			window.removeEventListener('blur', onBlur);
		};
	});
</script>

<button
	bind:this={buttonEl}
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
		{#if modHeld && parsed}
			<kbd class="kbd kbd-sm text-base-content">{shortcutLabel(parsed)}</kbd>
		{:else if icon}
			{@render icon()}
		{/if}
		{label}
	{/if}
</button>
