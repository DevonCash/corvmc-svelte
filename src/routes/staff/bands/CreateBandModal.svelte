<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Combobox } from 'bits-ui';
	import { searchUsers, createBand } from './data.remote';
	import Modal from '$lib/components/shared/Modal.svelte';

	let { open = $bindable(false) }: { open: boolean } = $props();

	let name = $state('');
	let bio = $state('');
	let ownerSearch = $state('');
	let selectedOwner = $state<{ id: string; name: string; email: string } | null>(null);
	let ownerComboValue = $state<string[]>([]);
	let submitting = $state(false);

	const ownerResults = $derived(ownerSearch.length >= 2 ? await searchUsers(ownerSearch) : []);

	$effect(() => {
		if (ownerComboValue.length > 0) {
			const id = ownerComboValue[0];
			const found = ownerResults.find((u) => u.id === id);
			if (found) {
				selectedOwner = found;
				ownerSearch = '';
			}
		}
	});

	function clearOwner() {
		selectedOwner = null;
		ownerComboValue = [];
	}

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
		ownerSearch = '';
		ownerComboValue = [];
	}
</script>

<Modal bind:open title="New Band" maxWidth="max-w-md" onclose={resetForm}>
	<svelte:boundary>
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
				{#if selectedOwner}
					<div class="flex items-center gap-2">
						<div class="badge gap-2 badge-lg">
							{selectedOwner.name}
							<button type="button" class="btn btn-circle btn-ghost btn-xs" onclick={clearOwner}>
								✕
							</button>
						</div>
						<span class="text-sm opacity-60">{selectedOwner.email}</span>
					</div>
				{:else}
					<Combobox.Root type="multiple" bind:value={ownerComboValue} inputValue={ownerSearch}>
						<div class="relative">
							<Combobox.Input
								placeholder="Search by name or email..."
								class="input-bordered input w-full"
								oninput={(e: Event) => {
									ownerSearch = (e.target as HTMLInputElement).value;
								}}
							/>
							<Combobox.Content
								class="menu z-10 max-h-40 w-full overflow-y-auto rounded-box bg-base-100 p-1 shadow-lg"
								sideOffset={4}
							>
								{#each ownerResults as u (u.id)}
									<Combobox.Item
										value={u.id}
										label={u.name}
										class="rounded-btn cursor-pointer px-3 py-2 data-[highlighted]:bg-base-200"
									>
										<span class="font-medium">{u.name}</span>
										<span class="ml-2 text-sm opacity-60">{u.email}</span>
									</Combobox.Item>
								{:else}
									{#if ownerSearch.length >= 2}
										<div class="px-3 py-2 opacity-60">No members found</div>
									{:else}
										<div class="px-3 py-2 opacity-60">Type to search...</div>
									{/if}
								{/each}
							</Combobox.Content>
						</div>
					</Combobox.Root>
				{/if}
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

		{#snippet pending()}
			<div class="flex items-center justify-center p-8">
				<span class="loading loading-md loading-spinner"></span>
			</div>
		{/snippet}
	</svelte:boundary>
</Modal>
