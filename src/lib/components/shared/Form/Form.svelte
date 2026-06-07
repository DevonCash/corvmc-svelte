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
		readonly currentStep: number;
		readonly totalSteps: number;
		readonly currentStepValid: boolean;
		registerStep(): number;
		setStepValid(index: number, valid: boolean): void;
		next(): void;
		back(): void;
		goToStep(index: number): void;
	}

	const FORM_KEY = Symbol('form');

	export function getFormContext(): FormContext | null {
		if (!hasContext(FORM_KEY)) return null;
		return getContext<FormContext>(FORM_KEY);
	}

	function setFormContext(ctx: FormContext) {
		setContext(FORM_KEY, ctx);
	}

	// Re-export for convenience (consumed by the membership form components).
	// eslint-disable-next-line no-import-assign -- type-only re-export of an imported type, not a runtime reassignment (rule false-positives on `export type {}` in a Svelte module script)
	export type { RemoteForm };
</script>

<script lang="ts" generics="TInput extends RemoteFormInput, TOutput">
	import type { Snippet } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { reportError } from '$lib/report-error';
	import { getErrorBoundary } from '../ErrorToastBoundary.svelte';
	import FormGuard from './FormGuard.svelte';

	let {
		remote,
		action,
		guard = false,
		flashDuration = 1500,
		successToast,
		onsuccess,
		onfailure,
		children,
		class: className,
		...rest
	}: {
		remote?: RemoteForm<TInput, TOutput> | Omit<RemoteForm<TInput, TOutput>, 'for'>;
		action?: (data: FormData) => Promise<TOutput | void>;
		guard?: boolean;
		flashDuration?: number;
		successToast?: string;
		onsuccess?: (result?: TOutput) => void;
		onfailure?: (issues: RemoteFormIssue[] | null) => void;
		children: Snippet;
		class?: string;
		[key: string]: unknown;
	} = $props();

	const errorBoundary = getErrorBoundary();

	let formEl: HTMLFormElement | undefined = $state();
	let changeCount = $state(0);
	let actionIssues = $state<RemoteFormIssue[] | null>(null);
	let currentStep = $state(0);
	let totalSteps = $state(0);
	let stepValidity = $state<boolean[]>([]);

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
			currentStep = 0;
		},
		changed() {
			changeCount++;
		},
		get currentStep() {
			return currentStep;
		},
		get totalSteps() {
			return totalSteps;
		},
		get currentStepValid() {
			return stepValidity[currentStep] ?? true;
		},
		registerStep() {
			stepValidity.push(true);
			return totalSteps++;
		},
		setStepValid(index: number, valid: boolean) {
			stepValidity[index] = valid;
		},
		next() {
			if (currentStep < totalSteps - 1) {
				currentStep++;
				changeCount++;
			}
		},
		back() {
			if (currentStep > 0) currentStep--;
		},
		goToStep(index: number) {
			currentStep = Math.max(0, Math.min(index, totalSteps - 1));
		}
	};
	setFormContext(ctx);

	const delay = (t: number) => new Promise((r) => setTimeout(r, Math.max(0, t)));

	// Step navigation is button-driven (a non-last-step button calls next()); the
	// only way to accidentally submit mid-wizard is pressing Enter inside a text
	// field, which we redirect to "advance" below. A submit *event* always means
	// "submit" and is never hijacked — buttons, links, and widgets keep their
	// native Enter behavior so a terminal submit button still submits.
	function handleKeydown(e: KeyboardEvent) {
		if (e.key !== 'Enter' || e.defaultPrevented) return; // a widget already handled it
		if (ctx.currentStep >= ctx.totalSteps - 1) return; // single/last step: submit natively
		// Only a text-like input implicitly submits the form on Enter. Leave
		// buttons, textareas, selects, and custom widgets alone.
		const t = e.target;
		const isTextField =
			t instanceof HTMLInputElement &&
			!['button', 'submit', 'reset', 'checkbox', 'radio'].includes(t.type);
		if (!isTextField) return;
		e.preventDefault();
		if (ctx.currentStepValid) ctx.next();
	}

	// In a multi-step wizard every step (and its submit button) is rendered at
	// once and merely hidden, so the form's *default* submit button is whichever
	// type=submit appears first in the DOM — which may belong to a later, hidden
	// step. An implicit submission (Enter on a widget the keydown guard doesn't
	// cover) would then fire that hidden button, POSTing the wrong step early
	// (e.g. creating a reservation before the Confirm screen). Only honor a submit
	// triggered by a *visible* button — i.e. the current step's. Explicit clicks
	// always have a visible submitter; stray implicit submits are dropped.
	function isVisible(el: HTMLElement): boolean {
		const check = (el as { checkVisibility?: () => boolean }).checkVisibility;
		if (typeof check === 'function') return check.call(el);
		return el.offsetParent !== null || el.getClientRects().length > 0;
	}

	function guardSubmit(e: SubmitEvent) {
		const submitter = e.submitter as HTMLElement | null;
		if (submitter && !isVisible(submitter)) {
			e.preventDefault();
			e.stopImmediatePropagation();
		}
	}

	let submitting = false;
	let remoteAttrs = $derived(
		remote?.enhance(async (...args) => {
			if (submitting) return;
			submitting = true;
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
					// Validation failed — expected. Field-level issues are already
					// rendered; surface them without reporting a bug to Sentry.
					await delay(150 - (performance.now() - start));
					if (onfailure) onfailure(ctx.issues);
					else toast.error('Please fix the highlighted fields and try again.');
					status = 'error';
				}
			} catch (err) {
				// Genuine submission failure (network/server). Capture it: forms with
				// an onfailure handler bypass the error boundary, so report directly.
				await delay(150 - (performance.now() - start));
				if (onfailure) {
					reportError(err);
					onfailure(ctx.issues);
				} else if (errorBoundary) {
					errorBoundary.reportError(err);
				} else {
					reportError(err);
				}
				status = 'error';
			} finally {
				submitting = false;
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
			if (errorBoundary) {
				errorBoundary.reportError(err); // reports to Sentry + toasts
			} else {
				reportError(err);
			}
			onfailure?.(null);
			status = 'error';
		}

		setTimeout(() => {
			status = 'idle';
		}, flashDuration);
	}
</script>

{#if remote}
	<form
		bind:this={formEl}
		{...remoteAttrs}
		onsubmitcapture={guardSubmit}
		onkeydown={handleKeydown}
		class={className}
		{...rest}
	>
		{@render children()}
	</form>
{:else}
	<form
		bind:this={formEl}
		onsubmit={handleActionSubmit}
		onsubmitcapture={guardSubmit}
		onkeydown={handleKeydown}
		class={className}
		{...rest}
	>
		{@render children()}
	</form>
{/if}
{#if guard}
	<FormGuard />
{/if}
