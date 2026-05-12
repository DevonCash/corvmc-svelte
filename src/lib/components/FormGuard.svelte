<script lang="ts" generics="T extends Record<string, unknown>">
	import type { Snippet } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';

	let {
		initial,
		pending = false,
		children
	}: {
		initial: T;
		pending?: boolean;
		children: Snippet<[T]>;
	} = $props();

	function serialize(obj: T): string {
		const copy: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
			copy[key] = Array.isArray(val) ? [...val].sort() : val;
		}
		return JSON.stringify(copy);
	}

	let form = $state<T>(structuredClone(initial));
	let lastInitial = serialize(initial);

	let dirty = $derived(serialize(form) !== serialize(initial));

	// Sync form when initial changes (post-save, navigation to different record)
	$effect(() => {
		const s = serialize(initial);
		if (s !== lastInitial) {
			lastInitial = s;
			form = structuredClone(initial);
		}
	});

	let confirmModal: HTMLDialogElement | undefined = $state();
	let pendingNavigation: (() => void) | null = $state(null);

	beforeNavigate(({ cancel, to, willUnload }) => {
		if (dirty && !pending) {
			cancel();
			if (!willUnload && to?.url) {
				const href = to.url.href;
				pendingNavigation = () => {
					form = structuredClone(initial);
					goto(href);
				};
				confirmModal?.showModal();
			}
		}
	});
</script>

<svelte:window
	onbeforeunload={(e) => {
		if (dirty && !pending) {
			e.preventDefault();
		}
	}}
/>

{@render children(form)}

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
