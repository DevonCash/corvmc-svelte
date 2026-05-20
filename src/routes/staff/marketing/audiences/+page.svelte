<script lang="ts">
	import { goto } from '$app/navigation';
	import { getAudiences } from './data.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import { CreateAudienceAction } from '$lib/components/shared/actions';
	import Badge from '$lib/components/shared/Badge.svelte';

	let audiences = $derived(await getAudiences());
</script>

	<PageHeader title="Audiences" subtitle="Marketing">
		<CreateAudienceAction onsuccess={(result) => {
			const r = result as { audienceId?: string };
			if (r?.audienceId) goto(`/staff/marketing/audiences/${r.audienceId}`);
		}} />
	</PageHeader>
<PageContent>
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
					<Badge variant="success">Public</Badge>
				{:else}
					<Badge variant="ghost">Staff only</Badge>
				{/if}
			{/snippet}
		</Column>
		<Column key="createdAt" header="Created" type="date" shrink sortable />
	</DataTable>
</PageContent>
