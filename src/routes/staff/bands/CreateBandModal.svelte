<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { searchUsers, createBand } from './data.remote';
	import Modal from '$lib/components/shared/Modal.svelte';
	import SearchSelect from '$lib/components/shared/Form/SearchSelect.svelte';

	let { open = $bindable(false) }: { open: boolean } = $props();

	let name = $state('');
	let bio = $state('');
	let selectedOwner = $state<{ id: string; name: string; email: string } | null>(null);
	let submitting = $state(false);

	async function handleSubmit() {
		if (!name.trim() || !selectedOwner) return;
		submitting = true;

		try {
			const result = await createBand({
				name: name.trim(),
				bio: bio.trim() || undefined,
				ownerId: selectedOwner.id
			});

			toast.success('Band created');
			open = false;
			resetForm();
			await invalidateAll();

			if (result?.bandId) {
				goto(`/staff/bands/${result.bandId}`);
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to create band');
		} finally {
			submitting = false;
		}
	}

	function resetForm() {
		name = '';
		bio = '';
		selectedOwner = null;
	}
</script>

<Modal bind:open title="New Band" maxWidth="max-w-md" onclose={resetForm}>
	<form
		onsubmit={(e) => {
			e.preventDefault();
			handleSubmit();
		}}
		class="space-y-4"
	>
		<fieldset class="fieldset">
			<legend class="fieldset-legend">Name</legend>
			<input
				id="band-name"
				type="text"
				bind:value={name}
				placeholder="Band name"
				class="input-bordered input w-full"
				required
			/>
		</fieldset>

		<fieldset class="fieldset">
			<legend class="fieldset-legend">Bio</legend>
			<textarea
				id="band-bio"
				bind:value={bio}
				placeholder="Optional description..."
				class="textarea-bordered textarea w-full"
				rows="3"
			></textarea>
		</fieldset>

		<fieldset class="fieldset">
			<legend class="fieldset-legend">Owner</legend>
			<SearchSelect
				search={searchUsers}
				bind:value={selectedOwner}
				placeholder="Search by name or email..."
			/>
		</fieldset>

		<div class="modal-action">
			<button type="button" class="btn btn-ghost" onclick={() => (open = false)}>Cancel</button>
			<button
				type="submit"
				class="btn btn-primary"
				disabled={!name.trim() || !selectedOwner || submitting}
			>
				{#if submitting}
					<span class="loading loading-sm loading-spinner"></span>
				{/if}
				Create Band
			</button>
		</div>
	</form>
</Modal>
