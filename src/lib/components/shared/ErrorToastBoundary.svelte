<script lang="ts" module>
	import { getContext, hasContext } from 'svelte';

	const ERROR_BOUNDARY_KEY = Symbol('error-toast-boundary');

	export interface ErrorBoundaryContext {
		reportError(err: unknown): void;
	}

	export function getErrorBoundary(): ErrorBoundaryContext | null {
		if (!hasContext(ERROR_BOUNDARY_KEY)) return null;
		return getContext<ErrorBoundaryContext>(ERROR_BOUNDARY_KEY);
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { setContext } from 'svelte';
	import { toast } from 'svelte-sonner';
	import Alert from './Alert.svelte';

	let {
		children,
		pending: pendingSnippet
	}: {
		children: Snippet;
		pending?: Snippet;
	} = $props();

	function extractMessage(err: unknown): string {
		if (err instanceof Error) return err.message;
		if (typeof err === 'string') return err;
		// Remote function rejections arrive as plain objects, e.g.
		// { body: { message: 'Internal Error' }, status: 500 }.
		if (err && typeof err === 'object') {
			const e = err as { message?: unknown; body?: { message?: unknown } };
			if (typeof e.body?.message === 'string') return e.body.message;
			if (typeof e.message === 'string') return e.message;
		}
		return 'Something went wrong';
	}

	function handleError(err: unknown) {
		console.error('[ErrorToastBoundary]', err);
		toast.error(extractMessage(err));
	}

	setContext(ERROR_BOUNDARY_KEY, {
		reportError: handleError
	} satisfies ErrorBoundaryContext);
</script>

<svelte:boundary onerror={handleError}>
	{@render children()}

	{#snippet pending()}
		{#if pendingSnippet}
			{@render pendingSnippet()}
		{:else}
			<div class="flex items-center justify-center p-12">
				<span class="loading loading-spinner loading-lg"></span>
			</div>
		{/if}
	{/snippet}

	{#snippet failed(error, reset)}
		<Alert type="error" {reset}>Failed to load: {extractMessage(error)}</Alert>
	{/snippet}
</svelte:boundary>
