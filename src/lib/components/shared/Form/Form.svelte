<script lang="ts" module>
	import { getContext, setContext } from 'svelte';
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
	import FormGuard from './FormGuard.svelte';

	let {
		remote,
		flashDuration = 1500,
		successToast,
		errorToast = 'Something went wrong',
		onsuccess,
		onfailure,
		children,
		class: className,
		...rest
	}: {
		remote: RemoteForm<TInput, TOutput> | Omit<RemoteForm<TInput, TOutput>, 'for'>;
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

	$effect(() => {
		if (status === 'idle' && changeCount > 0) status = 'dirty';
	});

	// --- Status tracking ---

	let status = $state<FormStatus>('idle');

	const ctx = {
		get status() {
			return status;
		},
		get issues() {
			return remote.fields.allIssues?.() ?? null;
		},
		issuesFor(fieldName: string) {
			return remote.fields[fieldName]?.issues() ?? null;
		},
		submit() {
			formEl?.requestSubmit();
		},
		reset() {
			formEl?.reset();
			changeCount = 0;
			status = 'idle';
		},
		changed() {
			changeCount++;
		}
	};
	setFormContext(ctx);

	// --- Build the enhanced form attributes ---
	const delay = (t: number) => new Promise((r) => setTimeout(r, Math.max(0, t)));
	let formAttrs = $derived(
		remote.enhance(async (...args) => {
			const [{ submit }] = args;
			status = 'pending';
			const start = performance.now();

			try {
				if (await submit()) {
					await delay(150 - (performance.now() - start));
					await onsuccess?.(remote.result);
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
</script>

<form bind:this={formEl} {...formAttrs} class={className} {...rest}>
	{@render children()}
</form>
<FormGuard />
