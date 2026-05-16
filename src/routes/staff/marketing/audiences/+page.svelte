<script lang="ts">
	import { getAudiences } from './data.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import CreateAudienceModal from './CreateAudienceModal.svelte';

	let showCreateModal = $state(false);
	let audiences = $derived(await getAudiences());
</script>

	<PageHeader title="Audiences" subtitle="Marketing">
		<button class="btn btn-sm btn-primary" onclick={() => (showCreateModal = true)}>
			New Audience
		</button>
	</PageHeader>

	<CreateAudienceModal bind:open={showCreateModal} />

	<DataTable data={audiences} rowHref={(a) => `/staff/marketing/audiences/${a.id}`} empty="No audiences yet. Create one to start building your email lists.">
		<Column key="name" header="Name" sortable>
			{#snippet cell(_, a)}
				<div>
					<p class="font-medium">{a.name}</p>
					{#if a.description}
						<p class="text-sm opacity-60 truncate max-w-xs">{a.description}</p>
					{/if}
				</div>
			{/snippet}
		</Column>
		<Column key="subscriberCount" header="Subscribers" sortable shrink />
		<Column key="allowOptIn" header="Opt-in" shrink>
			{#snippet cell(_, a)}
				{#if a.allowOptIn}
					<span class="badge badge-success badge-sm">Public</span>
				{:else}
					<span class="badge badge-ghost badge-sm">Staff only</span>
				{/if}
			{/snippet}
		</Column>
		<Column key="createdAt" header="Created" type="date" shrink sortable />
	</DataTable>


