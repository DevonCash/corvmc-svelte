<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import MemberColumn from '$lib/components/shared/Table/MemberColumn.svelte';
	import * as Filter from '$lib/components/shared/Table/Filter';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import { Field } from '$lib/components/shared/Form';
	import SearchSelect from '$lib/components/shared/Form/SearchSelect.svelte';
	import { searchUsers, createBand } from './data.remote';
	import type { StaffBandsResponse } from '$lib/types/api';

	let { data }: { data: StaffBandsResponse } = $props();

	let name = $state('');
	let bio = $state('');
	let selectedOwner = $state<{ id: string; name: string; email: string } | null>(null);
</script>

<PageHeader title="Bands">
		<Action
			action={async () => {
				const result = await createBand({
					name: name.trim(),
					bio: bio.trim() || undefined,
					ownerId: selectedOwner!.id
				});
				name = '';
				bio = '';
				selectedOwner = null;
				return result;
			}}
			label="New Band"
			modalTitle="New Band"
			submitLabel="Create Band"
			canSubmit={!!name.trim() && !!selectedOwner}
			successToast="Band created"
			class="btn-primary btn-sm"
			maxWidth="max-w-md"
			onsuccess={async (result) => {
				const r = result as { bandId?: string };
				await invalidateAll();
				if (r?.bandId) goto(`/staff/bands/${r.bandId}`);
			}}
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
	</PageHeader>
<PageContent>
	<DataTable data={data.bands} rowHref={(b) => `/staff/bands/${b.id}`} clearHref="/staff/bands" empty="No bands found">
		{#snippet toolbar()}
			<Filter.Search name="q" value={data.filters.search} placeholder="Search by name..." />
			<Filter.Select name="status" value={data.filters.status} placeholder="All statuses"
				options={[['active', 'Active'], ['deactivated', 'Deactivated']]} />
		{/snippet}
		<Column key="deletedAt" header="" shrink>
			{#snippet cell(_, b)}
				<StatusBadge status={b.deletedAt ? 'deactivated' : 'active'} />
			{/snippet}
		</Column>
		<Column key="name" header="Name" sortable />
		<MemberColumn nameKey="ownerName" userIdKey="ownerId" header="Owner" />
		<Column key="memberCount" header="Members" sortable />
		<Column key="createdAt" header="Created" sortable type="date" />
	</DataTable>
</PageContent>
