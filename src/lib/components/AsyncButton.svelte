<script lang="ts">
	import type { Snippet } from 'svelte';
	import { IconCheck, IconX } from '@tabler/icons-svelte';
	import { toast } from 'svelte-sonner';
	import { useShortcut, shortcutLabel } from '$lib/useShortcut.svelte';

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
	let buttonEl: HTMLButtonElement | undefined = $state();

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

	let keys = useShortcut(() => shortcut, () => {
		if (!buttonEl?.disabled) run();
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
</button>
