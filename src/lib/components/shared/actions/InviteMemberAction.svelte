<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { addBandMember } from '$lib/remote/bands.remote';
	import Button from '$lib/components/shared/Button.svelte';

	const { fields } = addBandMember;

	let {
		bandId,
		class: className = 'btn-sm btn-primary',
		onsuccess,
		...rest
	}: {
		bandId: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();

	let query = $state('');
	let userId = $state('');
	let userName = $state('');
	let searchResults = $state<{ id: string; name: string; email: string }[]>([]);

	async function handleSearch() {
		if (query.length < 2) {
			searchResults = [];
			return;
		}
		const res = await fetch(`/api/bands/${bandId}/search-members?q=${encodeURIComponent(query)}`);
		searchResults = await res.json();
	}

	function selectUser(u: { id: string; name: string }) {
		userId = u.id;
		userName = u.name;
		searchResults = [];
		query = '';
	}
</script>

<Action
	action={addBandMember}
	label="Add Member"
	modalTitle="Invite Member"
	canSubmit={!!userId}
	successToast="Invitation sent"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form()}
		<input {...fields.bandId.as('hidden', bandId)} />
		<input {...fields.userId.as('hidden', userId)} />
		<div class="space-y-3">
			{#if userId}
				<div class="flex items-center justify-between bg-base-200 rounded p-2">
					<span class="font-medium">{userName}</span>
					<Button
						type="button"
						class="btn-ghost btn-xs"
						onclick={() => {
							userId = '';
							userName = '';
						}}>Change</Button
					>
				</div>
			{:else}
				<label class="form-control w-full">
					<div class="label"><span class="label-text">Search members</span></div>
					<input
						type="text"
						class="input input-bordered w-full"
						bind:value={query}
						oninput={handleSearch}
						placeholder="Name or email..."
					/>
				</label>
				{#if searchResults.length > 0}
					<div class="bg-base-200 rounded max-h-40 overflow-y-auto">
						{#each searchResults as u (u.id)}
							<button
								type="button"
								class="w-full text-left px-3 py-2 hover:bg-base-300 text-sm"
								onclick={() => selectUser(u)}
							>
								<span class="font-medium">{u.name}</span>
								<span class="opacity-60 ml-1">{u.email}</span>
							</button>
						{/each}
					</div>
				{/if}
			{/if}
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Role</span></div>
				<select class="select select-bordered w-full" {...fields.role.as('select')}>
					<option value="member">Member</option>
					<option value="admin">Admin</option>
				</select>
			</label>
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Position (optional)</span></div>
				<input
					{...fields.position.as('text')}
					class="input input-bordered w-full"
					placeholder="e.g. Guitarist"
				/>
			</label>
		</div>
	{/snippet}
</Action>
