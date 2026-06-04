<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Modal from '$lib/components/shared/Modal.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { deleteBand as deleteBandForm } from '$lib/remote/bands.remote';
	import { getBandLayout } from '$lib/remote/layout.remote';
	import { page } from '$app/state';

	let layout = $derived(await getBandLayout(page.params.slug!));
	const band = $derived(layout.band);

	let showDeleteModal = $state(false);
</script>

<PageHeader title="Settings" subtitle={band.name} />
<PageContent width="md">
	<section class="space-y-4">
		<h2 class="text-lg font-semibold text-error">Danger Zone</h2>
		<div class="card bg-base-100 border border-error/30">
			<div class="card-body">
				<p class="text-sm">
					Deleting this band will cancel all future reservations and remove all members. This action
					cannot be undone.
				</p>
				<div class="card-actions justify-end mt-2">
					<Button class="btn-error btn-sm btn-outline" onclick={() => (showDeleteModal = true)}>
						Delete Band
					</Button>
				</div>
			</div>
		</div>
	</section>
</PageContent>

<Modal title="Delete Band" bind:open={showDeleteModal}>
	<Form
		remote={deleteBandForm}
		onsuccess={() => {
			toast.success('Band deleted');
			goto(resolve('/member/bands'));
		}}
		onfailure={() => toast.error('Failed to delete band')}
	>
		<div class="space-y-4">
			<div class="alert alert-error">
				<p>
					Are you sure you want to permanently delete <strong>{band.name}</strong>? All future
					reservations will be cancelled and all members will be removed.
				</p>
			</div>
			<div class="flex justify-end pt-2">
				<SubmitButton label="Delete Band" successLabel="Deleted" class="btn-error" />
			</div>
		</div>
	</Form>
</Modal>
