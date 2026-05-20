<script lang="ts">
	import Action from '../Action.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';
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

	let name = $state('');
	let bio = $state('');
	let selectedOwner = $state<{ id: string; name: string; email: string } | null>(null);

	async function searchUsers(q: string): Promise<{ id: string; name: string; email: string }[]> {
		const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
		return res.json();
	}

	async function execute() {
		const result = await actionFetch('/api/bands', {
			body: { name: name.trim(), bio: bio.trim() || undefined, ownerId: selectedOwner!.id }
		});
		name = '';
		bio = '';
		selectedOwner = null;
		return result;
	}
</script>

<Action
	action={execute}
	label="New Band"
	modalTitle="New Band"
	submitLabel="Create Band"
	canSubmit={!!name.trim() && !!selectedOwner}
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
		<Field name="name" type="text" label="Name" bind:value={name} />
		<Field name="bio" type="textarea" label="Bio" bind:value={bio} />
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
