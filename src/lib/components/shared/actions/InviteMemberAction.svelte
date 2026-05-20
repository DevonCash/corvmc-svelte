<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';

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
	let role = $state<'admin' | 'member'>('member');
	let position = $state('');
	let userId = $state('');
	let userName = $state('');
	let searchResults = $state<{ id: string; name: string; email: string }[]>([]);
	let searching = $state(false);

	async function handleSearch() {
		if (query.length < 2) { searchResults = []; return; }
		searching = true;
		try {
			const res = await fetch(`/api/bands/${bandId}/search-members?q=${encodeURIComponent(query)}`);
			searchResults = await res.json();
		} finally {
			searching = false;
		}
	}

	function selectUser(u: { id: string; name: string }) {
		userId = u.id;
		userName = u.name;
		searchResults = [];
		query = '';
	}

	function execute() {
		const result = actionFetch(`/api/bands/${bandId}/members`, {
			body: { userId, role, position: position || undefined }
		});
		userId = '';
		userName = '';
		role = 'member';
		position = '';
		return result;
	}
</script>

<Action
	action={execute}
	label="Add Member"
	modalTitle="Invite Member"
	canSubmit={!!userId}
	successToast="Invitation sent"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<div class="space-y-3">
			{#if userId}
				<div class="flex items-center justify-between bg-base-200 rounded p-2">
					<span class="font-medium">{userName}</span>
					<button type="button" class="btn btn-ghost btn-xs" onclick={() => { userId = ''; userName = ''; }}>Change</button>
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
						{#each searchResults as u}
							<button type="button" class="w-full text-left px-3 py-2 hover:bg-base-300 text-sm" onclick={() => selectUser(u)}>
								<span class="font-medium">{u.name}</span>
								<span class="opacity-60 ml-1">{u.email}</span>
							</button>
						{/each}
					</div>
				{/if}
			{/if}
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Role</span></div>
				<select class="select select-bordered w-full" bind:value={role}>
					<option value="member">Member</option>
					<option value="admin">Admin</option>
				</select>
			</label>
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Position (optional)</span></div>
				<input type="text" class="input input-bordered w-full" bind:value={position} placeholder="e.g. Guitarist" />
			</label>
		</div>
	{/snippet}
</Action>
