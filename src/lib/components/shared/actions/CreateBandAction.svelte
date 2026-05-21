<script lang="ts">
	import Action from '../Action.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { createBandApi } from '$lib/remote/bands.remote';
	import { Field } from '../Form';
	import SearchSelect from '../Form/SearchSelect.svelte';

	let {
		class: className = 'btn-primary btn-sm',
		onsuccess,
		...rest
	}: {
		class?: string;
		onsuccess?: (result?: unknown) => void;
		[key: string]: unknown;
	} = $props();

	let selectedOwner = $state<{ id: string; name: string; email: string } | null>(null);

	async function searchUsers(q: string): Promise<{ id: string; name: string; email: string }[]> {
		const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
		return res.json();
	}
</script>

<Action
	action={createBandApi}
	label="New Band"
	modalTitle="New Band"
	submitLabel="Create Band"
	canSubmit={!!selectedOwner}
	maxWidth="max-w-md"
	successToast="Band created"
	class={className}
	onsuccess={onsuccess ?? (async (result) => {
		const r = result as { bandId?: string };
		await invalidateAll();
		if (r?.bandId) goto(`/staff/bands/${r.bandId}`);
	})}
	{...rest}
>
	{#snippet form({ close })}
		{#if selectedOwner}
			<input type="hidden" name="ownerId" value={selectedOwner.id} />
		{/if}
		<Field name="name" type="text" label="Name" />
		<Field name="bio" type="textarea" label="Bio" />
		<fieldset class="fieldset">
			<legend class="fieldset-legend">Owner</legend>
			<SearchSelect
				search={searchUsers}
				bind:value={selectedOwner}
				placeholder="Search by name or email..."
			/>
		</fieldset>
	{/snippet}
</Action>
