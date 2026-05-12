<script lang="ts">
	import type { Snippet } from 'svelte';
	import { toast } from 'svelte-sonner';
	import {
		parseShortcut,
		matchesShortcut,
		isModifierKey,
		shortcutLabel
	} from '$lib/shortcuts';

	let {
		action,
		shortcut,
		icon,
		label = 'Run',
		successLabel = 'Done',
		errorLabel = 'Error',
		successToast,
		errorToast = 'Something went wrong',
		flashDuration = 1500,
		class: className = 'btn-primary',
		disabled = false,
		onsuccess,
		onfailure,
		...rest
	}: {
		action: () => Promise<unknown>;
		shortcut?: string;
		icon?: Snippet;
		label?: string;
		successLabel?: string;
		errorLabel?: string;
		successToast?: string;
		errorToast?: string;
		flashDuration?: number;
		class?: string;
		disabled?: boolean;
		onsuccess?: (result?: unknown) => void;
		onfailure?: (error?: unknown) => void;
		[key: string]: unknown;
	} = $props();

	type Status = 'idle' | 'pending' | 'success' | 'error';
	let status = $state<Status>('idle');
	let modHeld = $state(false);
	let buttonEl: HTMLButtonElement | undefined = $state();

	let parsed = $derived(shortcut ? parseShortcut(shortcut) : null);

	async function run() {
		if (status === 'pending') return;

		status = 'pending';
		const minDelay = new Promise((r) => setTimeout(r, 150));

		try {
			const result = await action();
			await minDelay;
			onsuccess?.(result);
			if (successToast) toast.success(successToast);
			status = 'success';
		} catch (err) {
			console.error('[AsyncButton] action failed:', err);
			await minDelay;
			onfailure?.(err);
			const message = err instanceof Error ? err.message : errorToast;
			if (message) toast.error(message);
			status = 'error';
		}

		setTimeout(() => {
			status = 'idle';
		}, flashDuration);
	}

	// Keyboard shortcut handling
	$effect(() => {
		if (!parsed) return;
		const p = parsed;

		function onKeydown(e: KeyboardEvent) {
			if (isModifierKey(e, p)) modHeld = true;
			if (matchesShortcut(e, p)) {
				e.preventDefault();
				if (!buttonEl?.disabled) {
					run();
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
	type="button"
	class="btn {className}"
	class:btn-success={status === 'success'}
	class:btn-error={status === 'error'}
	disabled={disabled || status === 'pending'}
	onclick={run}
	{...rest}
>
	{#if status === 'pending'}
		<span class="loading loading-spinner loading-sm"></span>
		{label}
	{:else if status === 'success'}
		<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
			<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
		</svg>
		{successLabel}
	{:else if status === 'error'}
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
