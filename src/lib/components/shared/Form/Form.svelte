<script lang="ts" module>
	import { getContext, hasContext, setContext } from 'svelte';
	import type { RemoteForm, RemoteFormInput, RemoteFormIssue } from '@sveltejs/kit';

	export type FormStatus = 'idle' | 'dirty' | 'pending' | 'success' | 'error';

	export interface FormContext {
		readonly status: FormStatus;
		readonly issues: RemoteFormIssue[] | null;
		issuesFor(fieldName: string): RemoteFormIssue[] | null;
		readonly values?: Record<string, unknown>;
		submit(): void;
		reset(): void;
		changed(): void;
	}

	const FORM_KEY = Symbol('form');

	export function getFormContext(): FormContext | null {
		if (!hasContext(FORM_KEY)) return null;
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
	import FormGuard from './FormGuard.svelte';

	let {
		remote,
		action,
		flashDuration = 1500,
		successToast,
		errorToast = 'Something went wrong',
		onsuccess,
		onfailure,
		children,
		class: className,
		...rest
	}: {
		remote?: RemoteForm<TInput, TOutput> | Omit<RemoteForm<TInput, TOutput>, 'for'>;
		action?: (data: FormData) => Promise<TOutput | void>;
		flashDuration?: number;
		successToast?: string;
		errorToast?: string;
		onsuccess?: (result?: TOutput) => void;
		onfailure?: (issues: RemoteFormIssue[] | null) => void;
		children: Snippet;
		class?: string;
		[key: string]: unknown;
	} = $props();

	let formEl: HTMLFormElement | undefined = $state();
	let changeCount = $state(0);
	let actionIssues = $state<RemoteFormIssue[] | null>(null);

	$effect(() => {
		if (status === 'idle' && changeCount > 0) status = 'dirty';
	});

	let status = $state<FormStatus>('idle');

	const ctx = {
		get status() {
			return status;
		},
		get issues() {
			if (remote) return remote.fields.allIssues?.() ?? null;
			return actionIssues;
		},
		issuesFor(fieldName: string) {
			if (remote) return remote.fields[fieldName]?.issues() ?? null;
			return actionIssues?.filter((i) => i.path?.includes(fieldName)) ?? null;
		},
		submit() {
			formEl?.requestSubmit();
		},
		reset() {
			formEl?.reset();
			changeCount = 0;
			actionIssues = null;
			status = 'idle';
		},
		changed() {
			changeCount++;
		}
	};
	setFormContext(ctx);

	const delay = (t: number) => new Promise((r) => setTimeout(r, Math.max(0, t)));

	let remoteAttrs = $derived(
		remote?.enhance(async (...args) => {
			const [{ submit }] = args;
			status = 'pending';
			const start = performance.now();

			try {
				if (await submit()) {
					await delay(150 - (performance.now() - start));
					await onsuccess?.(remote!.result);
					if (successToast) toast.success(successToast);
					status = 'success';
					changeCount = 0;
				} else {
					throw new Error('Form validation failed');
				}
			} catch (err) {
				await delay(150 - (performance.now() - start));
				console.error('[Form] submission error:', err);
				onfailure?.(ctx.issues);
				const message = err instanceof Error ? err.message : errorToast;
				if (message) toast.error(message);
				status = 'error';
			}

			setTimeout(() => {
				status = 'idle';
			}, flashDuration);
		})
	);

	async function handleActionSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!action || !formEl) return;
		status = 'pending';
		actionIssues = null;
		const start = performance.now();

		try {
			const result = await action(new FormData(formEl));
			await delay(150 - (performance.now() - start));
			await onsuccess?.(result ?? undefined);
			if (successToast) toast.success(successToast);
			status = 'success';
			changeCount = 0;
		} catch (err) {
			await delay(150 - (performance.now() - start));
			console.error('[Form] submission error:', err);
			onfailure?.(null);
			const message = err instanceof Error ? err.message : errorToast;
			if (message) toast.error(message);
			status = 'error';
		}

		setTimeout(() => {
			status = 'idle';
		}, flashDuration);
	}
</script>

{#if remote}
	<form bind:this={formEl} {...remoteAttrs} class={className} {...rest}>
		{@render children()}
	</form>
{:else}
	<form bind:this={formEl} onsubmit={handleActionSubmit} class={className} {...rest}>
		{@render children()}
	</form>
{/if}
<FormGuard />
