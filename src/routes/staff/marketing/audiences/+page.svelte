<script lang="ts">
	import { getAudiences } from './data.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
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

	{#if audiences.length === 0}
		<EmptyState message="No audiences yet. Create one to start building your email lists." />
	{:else}
		<div class="overflow-x-auto">
			<table class="table">
				<thead>
					<tr>
						<th>Name</th>
						<th>Subscribers</th>
						<th>Opt-in</th>
						<th>Created</th>
					</tr>
				</thead>
				<tbody>
					{#each audiences as a (a.id)}
						<tr
							class="hover cursor-pointer"
							onclick={() => (window.location.href = `/staff/marketing/audiences/${a.id}`)}
						>
							<td>
								<div>
									<p class="font-medium">{a.name}</p>
									{#if a.description}
										<p class="text-sm opacity-60 truncate max-w-xs">{a.description}</p>
									{/if}
								</div>
							</td>
							<td>{a.subscriberCount}</td>
							<td>
								{#if a.allowOptIn}
									<span class="badge badge-success badge-sm">Public</span>
								{:else}
									<span class="badge badge-ghost badge-sm">Staff only</span>
								{/if}
							</td>
							<td class="text-sm">{new Date(a.createdAt).toLocaleDateString()}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}


