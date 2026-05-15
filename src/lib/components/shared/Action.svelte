<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { RemoteForm, RemoteFormInput } from '@sveltejs/kit';
	import { IconCheck, IconX } from '@tabler/icons-svelte';
	import { toast } from 'svelte-sonner';
	import { Dialog } from 'bits-ui';
	import Form from './Form/Form.svelte';
	import SubmitButton from './Form/SubmitButton.svelte';

	// ---------------------------------------------------------------------------
	// Props
	// ---------------------------------------------------------------------------

	let {
		action,
		label = 'Run',
		icon,
		successLabel = 'Done',
		errorLabel = 'Error',
		confirm,
		modalTitle,
		body,
		submitLabel,
		successToast,
		errorToast = 'Something went wrong',
		flashDuration = 1500,
		class: className = 'btn-primary',
		disabled = false,
		onsuccess,
		onfailure,
		...rest
	}: {
		/** Async callback or a RemoteForm from form(). When a RemoteForm is passed, a body snippet is expected and the action renders as a form modal. */
		action: (() => Promise<unknown>) | RemoteForm<any, any>;
		label?: string;
		icon?: Snippet;
		successLabel?: string;
		errorLabel?: string;
		/** When set, a confirmation dialog is shown before firing a callback action. The string is used as the dialog message. */
		confirm?: string;
		/** Title for the form modal. Only used when action is a RemoteForm. */
		modalTitle?: string;
		/** Form content rendered inside a modal with a <Form> wrapper. Only used when action is a RemoteForm. */
		body?: Snippet;
		/** Label for the submit button inside the form modal. Defaults to `label`. */
		submitLabel?: string;
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

	// ---------------------------------------------------------------------------
	// Shared state
	// ---------------------------------------------------------------------------

	type Status = 'idle' | 'pending' | 'success' | 'error';
	let status = $state<Status>('idle');

	// Dialog state (confirm or form modal)
	let dialogOpen = $state(false);

	// ---------------------------------------------------------------------------
	// Direct / confirm action mode
	// ---------------------------------------------------------------------------

	async function run() {
		if (status === 'pending' || isForm) return;

		status = 'pending';
		const minDelay = new Promise((r) => setTimeout(r, 150));

		try {
			const result = await (action as () => Promise<unknown>)();
			await minDelay;
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
		if (isForm) {
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

<!-- Trigger button -->
<button
	type="button"
	class="btn {className}"
	class:btn-success={status === 'success'}
	class:btn-error={status === 'error'}
	disabled={disabled || status === 'pending'}
	onclick={handleClick}
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
		{#if icon}
			{@render icon()}
		{/if}
		{label}
	{/if}
</button>

<!-- Confirm dialog (callback + confirm string) -->
{#if !isForm && confirm}
	<Dialog.Root bind:open={dialogOpen}>
		<Dialog.Portal>
			<Dialog.Overlay class="modal modal-open bg-black/40" />
			<Dialog.Content class="modal modal-open">
				<div class="modal-box max-w-sm">
					<Dialog.Title class="text-lg font-bold">Confirm</Dialog.Title>
					<p class="py-4">{confirm}</p>
					<div class="modal-action">
						<Dialog.Close class="btn btn-ghost">Cancel</Dialog.Close>
						<button type="button" class="btn {className}" onclick={handleConfirm}>
							{label}
						</button>
					</div>
				</div>
			</Dialog.Content>
		</Dialog.Portal>
	</Dialog.Root>
{/if}

<!-- Form modal (RemoteForm action + body snippet) -->
{#if isForm && body}
	<Dialog.Root bind:open={dialogOpen}>
		<Dialog.Portal>
			<Dialog.Overlay class="modal modal-open bg-black/40" />
			<Dialog.Content class="modal modal-open">
				<div class="modal-box max-w-lg">
					<div class="flex items-center justify-between mb-4">
						{#if modalTitle}
							<Dialog.Title class="text-lg font-bold">{modalTitle}</Dialog.Title>
						{/if}
						<Dialog.Close class="btn btn-sm btn-ghost btn-circle">✕</Dialog.Close>
					</div>

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
							{@render body()}
							<div class="flex justify-end pt-2">
								<SubmitButton label={submitLabel ?? label} class={className} />
							</div>
						</div>
					</Form>
				</div>
			</Dialog.Content>
		</Dialog.Portal>
	</Dialog.Root>
{/if}
