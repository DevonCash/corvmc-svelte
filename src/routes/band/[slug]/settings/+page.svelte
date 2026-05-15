<script lang="ts">
	import type { PageData } from './$types';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import Modal from '$lib/components/shared/Modal.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { goto } from '$app/navigation';
	import { deleteBandForm } from './data.remote';

	let { data }: { data: PageData } = $props();

	const band = $derived(data?.band);

	let showDeleteModal = $state(false);
</script>

<div class="max-w-md space-y-6">
	<PageHeader title="Settings" subtitle={band.name} />

	<section class="space-y-4">
		<h2 class="text-lg font-semibold text-error">Danger Zone</h2>
		<div class="card bg-base-100 border border-error/30">
			<div class="card-body">
				<p class="text-sm">
					Deleting this band will cancel all future reservations and remove all members.
					This action cannot be undone.
				</p>
				<div class="card-actions justify-end mt-2">
					<button class="btn btn-error btn-sm btn-outline" onclick={() => (showDeleteModal = true)}>
						Delete Band
					</button>
				</div>
			</div>
		</div>
	</section>
</div>

<Modal title="Delete Band" bind:open={showDeleteModal}>
	<Form
		remote={deleteBandForm}
		successToast="Band deleted"
		errorToast="Failed to delete band"
		onsuccess={() => goto('/member/bands')}
	>
		<div class="space-y-4">
			<div class="alert alert-error">
				<p>
					Are you sure you want to permanently delete <strong>{band.name}</strong>?
					All future reservations will be cancelled and all members will be removed.
				</p>
			</div>
			<div class="flex justify-end pt-2">
				<SubmitButton label="Delete Band" successLabel="Deleted" class="btn-error" />
			</div>
		</div>
	</Form>
</Modal>
