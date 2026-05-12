<script lang="ts" module>
	import { getContext, setContext } from 'svelte';
	import type { RemoteForm, RemoteFormInput } from '@sveltejs/kit';

	export type FormStatus = 'idle' | 'pending' | 'success' | 'error';

	export interface FormContext {
		readonly status: FormStatus;
	}

	const FORM_KEY = Symbol('form');

	export function getFormContext(): FormContext {
		return getContext<FormContext>(FORM_KEY);
	}

	function setFormContext(ctx: FormContext) {
		setContext(FORM_KEY, ctx);
	}

	// Re-export for convenience
	export type { RemoteForm };
</script>

<script lang="ts" generics="TInput extends RemoteFormInput, TOutput">
	import type { Snippet } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { beforeNavigate, goto } from '$app/navigation';

	let {
		remote,
		initial,
		flashDuration = 1500,
		successToast,
		errorToast = 'Something went wrong',
		onsuccess,
		onfailure,
		children,
		class: className,
		...rest
	}: {
		remote: RemoteForm<TInput, TOutput>;
		initial: Record<string, unknown>;
		flashDuration?: number;
		successToast?: string;
		errorToast?: string;
		onsuccess?: (result?: TOutput) => void;
		onfailure?: () => void;
		children: Snippet;
		class?: string;
		[key: string]: unknown;
	} = $props();

	// --- Dirty tracking ---

	function serialize(obj: Record<string, unknown>): string {
		const copy: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(obj)) {
			copy[key] = Array.isArray(val) ? [...val].sort() : val;
		}
		return JSON.stringify(copy);
	}

	let formEl: HTMLFormElement | undefined = $state();
	let changeCount = $state(0);

	function readFormValues(): Record<string, unknown> {
		if (!formEl) return {};
		const fd = new FormData(formEl);
		const result: Record<string, unknown> = {};
		// Use initial's keys so we always compare the same shape
		for (const key of Object.keys(initial)) {
			const values = fd.getAll(key);
			result[key] = Array.isArray(initial[key]) ? values : (values[0] ?? '');
		}
		return result;
	}

	// changeCount is a reactive dependency that forces re-evaluation when inputs change
	let dirty = $derived.by(() => {
		void changeCount;
		return serialize(readFormValues()) !== serialize(initial);
	});

	// --- Status tracking ---

	let status = $state<FormStatus>('idle');

	setFormContext({
		get status() {
			return status;
		}
	});

	// --- Build the enhanced form attributes ---

	let formAttrs = $derived(remote.enhance(async ({ submit }) => {
		status = 'pending';
		const minDelay = new Promise((r) => setTimeout(r, 150));

		try {
			const ok = await submit();
			await minDelay;

			if (ok) {
				onsuccess?.(remote.result);
				if (successToast) toast.success(successToast);
				status = 'success';
			} else {
				const issues = remote.fields.allIssues?.() ?? [];
				console.warn('[Form] validation failed:', issues);
				onfailure?.();
				const message = issues[0]?.message ?? errorToast;
				if (message) toast.error(message);
				status = 'error';
			}
		} catch (err) {
			await minDelay;
			console.error('[Form] submission error:', err);
			onfailure?.();
			const message = err instanceof Error ? err.message : errorToast;
			if (message) toast.error(message);
			status = 'error';
		}

		setTimeout(() => { status = 'idle'; }, flashDuration);
	}));

	// --- Navigation guard ---

	let confirmModal: HTMLDialogElement | undefined = $state();
	let pendingNavigation: (() => void) | null = $state(null);
	let bypassing = false;

	beforeNavigate(({ cancel, to, willUnload }) => {
		if (bypassing) {
			bypassing = false;
			return;
		}
		if (dirty && status !== 'pending') {
			cancel();
			if (!willUnload && to?.url) {
				const href = to.url.href;
				pendingNavigation = () => {
					bypassing = true;
					formEl?.reset();
					changeCount = 0;
					goto(href);
				};
				confirmModal?.showModal();
			}
		}
	});
</script>

<svelte:window
	onbeforeunload={(e) => {
		if (dirty && status !== 'pending') {
			e.preventDefault();
		}
	}}
/>

<form
	bind:this={formEl}
	{...formAttrs}
	class={className}
	oninput={() => changeCount++}
	onchange={() => changeCount++}
	{...rest}
>
	{@render children()}
</form>

<dialog bind:this={confirmModal} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-bold">Unsaved changes</h3>
		<p class="py-4">You have unsaved changes. Are you sure you want to leave?</p>
		<div class="modal-action">
			<button
				type="button"
				class="btn"
				onclick={() => confirmModal?.close()}
			>
				Keep editing
			</button>
			<button
				type="button"
				class="btn btn-error"
				onclick={() => {
					confirmModal?.close();
					pendingNavigation?.();
					pendingNavigation = null;
				}}
			>
				Discard changes
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button type="submit">close</button>
	</form>
</dialog>
