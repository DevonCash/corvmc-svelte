<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { RemoteForm, RemoteFormInput } from '@sveltejs/kit';
	import { toast } from 'svelte-sonner';
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import Form from './Form/Form.svelte';
	import SubmitButton from './Form/SubmitButton.svelte';

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
		canSubmit = true,
		maxWidth = 'max-w-lg',
		successToast,
		errorToast = 'Something went wrong',
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
		canSubmit?: boolean;
		maxWidth?: string;
		successToast?: string;
		errorToast?: string;
		flashDuration?: number;
		class?: string;
		disabled?: boolean;
		onsuccess?: (result?: unknown) => void;
		onfailure?: (error?: unknown) => void;
		[key: string]: unknown;
	} = $props();

	// ---------------------------------------------------------------------------
	// Mode detection
	// ---------------------------------------------------------------------------

	const isForm = $derived(typeof action !== 'function');
	const hasModal = $derived(isForm || !!body || (!!formSnippet && !confirm));

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
			if (successToast) toast.success(successToast);
			status = 'success';
		} catch (err) {
			console.error('[Action] action failed:', err);
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

	function handleClick() {
		if (hasModal) {
			dialogOpen = true;
		} else if (confirm) {
			dialogOpen = true;
		} else {
			run();
		}
	}

	function handleConfirm() {
		dialogOpen = false;
		run();
	}
</script>

<!-- Trigger -->
{#if trigger}
	{@render trigger({ onclick: handleClick, disabled: disabled || status === 'pending', status })}
{:else}
	<Button
		{label}
		{icon}
		{shortcut}
		{status}
		{successLabel}
		{errorLabel}
		disabled={disabled || status === 'pending'}
		onclick={handleClick}
		class={className}
		{...rest}
	/>
{/if}

<!-- Confirm dialog (callback + confirm string, no form/body) -->
{#if !isForm && confirm && !formSnippet && !body}
	<Modal bind:open={dialogOpen} title="Confirm" maxWidth="max-w-sm">
		<p class="py-4">{confirm}</p>
		<div class="modal-action">
			<button type="button" class="btn btn-ghost" onclick={close}>Cancel</button>
			<button type="button" class="btn {className}" onclick={handleConfirm}>
				{label}
			</button>
		</div>
	</Modal>
{/if}

<!-- Callback + body modal (full control — consumer owns entire content area) -->
{#if !isForm && body}
	<Modal bind:open={dialogOpen} {maxWidth}>
		{@render body({ close, run, status })}
	</Modal>
{/if}

<!-- Callback + form modal (default layout with title bar + submit button) -->
{#if !isForm && formSnippet && !body}
	<Modal bind:open={dialogOpen} title={modalTitle} {maxWidth}>
		<div class="space-y-4">
			{@render formSnippet({ close })}
			<div class="flex justify-end pt-2">
				<button
					type="button"
					class="btn {className}"
					disabled={!canSubmit || status === 'pending'}
					onclick={run}
				>
					{#if status === 'pending'}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					{submitLabel ?? label}
				</button>
			</div>
		</div>
	</Modal>
{/if}

<!-- Form modal with RemoteForm + form snippet (default layout) -->
{#if isForm && formSnippet && !body}
	<Modal bind:open={dialogOpen} title={modalTitle} {maxWidth}>
		<Form
			remote={action as RemoteForm<any, any>}
			{successToast}
			{errorToast}
			onsuccess={(result) => {
				dialogOpen = false;
				onsuccess?.(result);
			}}
			onfailure={(issues) => {
				onfailure?.(issues);
			}}
		>
			<div class="space-y-4">
				{@render formSnippet({ close })}
				<div class="flex justify-end pt-2">
					<SubmitButton label={submitLabel ?? label} class={className} />
				</div>
			</div>
		</Form>
	</Modal>
{/if}

<!-- Form modal with RemoteForm + body snippet (full control) -->
{#if isForm && body}
	<Modal bind:open={dialogOpen} {maxWidth}>
		<Form
			remote={action as RemoteForm<any, any>}
			{successToast}
			{errorToast}
			onsuccess={(result) => {
				dialogOpen = false;
				onsuccess?.(result);
			}}
			onfailure={(issues) => {
				onfailure?.(issues);
			}}
		>
			{@render body({ close, run: () => {}, status })}
		</Form>
	</Modal>
{/if}
