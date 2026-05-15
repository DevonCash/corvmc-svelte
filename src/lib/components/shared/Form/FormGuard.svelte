<script lang="ts">
	import { beforeNavigate, goto } from '$app/navigation';
	import { getFormContext } from './Form.svelte';

	let confirmModal: HTMLDialogElement | undefined = $state();
	let pendingNavigation: (() => void) | null = $state(null);
	let bypassing = $state(false);

	const form = getFormContext()!;

	beforeNavigate(({ cancel, to, willUnload }) => {
		if (bypassing) {
			bypassing = false;
			return;
		}
		if (form.status === 'dirty') {
			cancel();
			if (!willUnload && to?.url) {
				const href = to.url.href;
				pendingNavigation = () => {
					bypassing = true;
					form.reset();
					goto(href);
				};
				confirmModal?.showModal();
			}
		}
	});
</script>

<svelte:window
	onbeforeunload={(e) => {
		if (form.status === 'dirty') {
			e.preventDefault();
		}
	}}
/>

<dialog bind:this={confirmModal} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-bold">Unsaved changes</h3>
		<p class="py-4">You have unsaved changes. Are you sure you want to leave?</p>
		<div class="modal-action">
			<button type="button" class="btn" onclick={() => confirmModal?.close()}>
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
