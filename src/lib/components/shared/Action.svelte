<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { RemoteForm, RemoteFormInput } from '@sveltejs/kit';
	import { toast } from 'svelte-sonner';
	import { getErrorBoundary } from './ErrorToastBoundary.svelte';
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import Form from './Form/Form.svelte';
	import SubmitButton from './Form/SubmitButton.svelte';
	import { IconCheck, IconX } from '@tabler/icons-svelte';

	// ---------------------------------------------------------------------------
	// Props
	// ---------------------------------------------------------------------------

	type Status = 'idle' | 'pending' | 'success' | 'error';

	interface TriggerProps {
		onclick: () => void;
		disabled: boolean;
		status: Status;
	}

	let {
		action,
		shortcut,
		label = 'Run',
		icon,
		successLabel = 'Done',
		errorLabel = 'Error',
		confirm,
		modalTitle,
		form: formSnippet,
		body,
		trigger,
		submitLabel,
		submitClass,
		canSubmit = true,
		noFooter = false,
		successToast,
		maxWidth = 'max-w-lg',
		flashDuration = 1500,
		class: className = 'btn-primary',
		disabled = false,
		onsuccess,
		onfailure,
		...rest
	}: {
		action: (() => Promise<unknown>) | RemoteForm<any, any>;
		shortcut?: string;
		label?: string;
		icon?: Snippet;
		successLabel?: string;
		errorLabel?: string;
		confirm?: string;
		modalTitle?: string;
		form?: Snippet<[{ close: () => void }]>;
		body?: Snippet<[{ close: () => void; run: () => void; status: Status }]>;
		trigger?: Snippet<[TriggerProps]>;
		submitLabel?: string;
		submitClass?: string;
		canSubmit?: boolean;
		noFooter?: boolean;
		maxWidth?: string;
		successToast?: string;
		flashDuration?: number;
		class?: string;
		disabled?: boolean;
		onsuccess?: (result?: unknown) => void;
		onfailure?: (error?: unknown) => void;
		[key: string]: unknown;
	} = $props();

	const errorBoundary = getErrorBoundary();

	// ---------------------------------------------------------------------------
	// Mode detection
	// ---------------------------------------------------------------------------

	const isForm = $derived(typeof action !== 'function');
	const hasModal = $derived(isForm || !!body || !!confirm);

	// ---------------------------------------------------------------------------
	// Shared state
	// ---------------------------------------------------------------------------

	let status = $state<Status>('idle');
	let dialogOpen = $state(false);

	function close() {
		dialogOpen = false;
	}

	// ---------------------------------------------------------------------------
	// Direct / confirm / callback+form / callback+body action mode
	// ---------------------------------------------------------------------------

	async function run() {
		if (status === 'pending' || isForm) return;

		status = 'pending';
		const minDelay = new Promise((r) => setTimeout(r, 150));

		try {
			const result = await (action as () => Promise<unknown>)();
			await minDelay;
			dialogOpen = false;
			onsuccess?.(result);
			toast.success(successToast ?? `${label} successful`);
			status = 'success';
		} catch (err) {
			await minDelay;
			onfailure?.(err);
			status = 'error';
			console.error('[Action] action failed:', err);
			throw err;
		} finally {
			setTimeout(() => {
				status = 'idle';
			}, flashDuration);
		}
	}

	function handleClick() {
		hasModal ? (dialogOpen = true) : run();
	}

	function handleFormSuccess(result?: unknown) {
		dialogOpen = false;
		if (typeof onsuccess === 'function') onsuccess(result);
	}

	function handleFormFailure(issues?: unknown) {
		if (typeof onfailure === 'function') onfailure(issues);
	}
</script>

<!-- Trigger -->
{#if trigger}
	{@render trigger({ onclick: handleClick, disabled: disabled || status === 'pending', status })}
{:else}
	<Button
		{label}
		{icon}
		disabled={disabled || status === 'pending'}
		onclick={handleClick}
		class={className}
		{...rest}
	>
		{#if status === 'success'}
			<IconCheck size={16} />
			{successLabel}
		{:else if status === 'error'}
			<IconX size={16} />
			{errorLabel}
		{:else if status === 'pending'}
			<span class="loading loading-spinner"></span>
			{label}
		{:else}
			{@render icon?.()}
			{label}
		{/if}
	</Button>
{/if}

{#if hasModal}
	<Modal bind:open={dialogOpen} title={modalTitle} {maxWidth}>
		{#if body}
			{@render body({ close, run, status })}
		{:else if confirm}
			<p class="py-4">{confirm}</p>
			<div class="modal-action">
				<Button type="button" class="btn-outline" onclick={close}>Dismiss</Button>
				<Button type="button" variant="primary" onclick={run}>
					{@render icon?.()}
					{label}
				</Button>
			</div>
		{:else if formSnippet}
			<Form
				class="space-y-4"
				remote={action as RemoteForm<any, any>}
				{successToast}
				onsuccess={handleFormSuccess}
				onfailure={handleFormFailure}
			>
				{@render formSnippet?.({ close })}
				{#if !noFooter}
					<div class="flex justify-end pt-2">
						<SubmitButton label={submitLabel ?? label} class={submitClass ?? className} />
					</div>
				{/if}
			</Form>
		{/if}
	</Modal>
{/if}
