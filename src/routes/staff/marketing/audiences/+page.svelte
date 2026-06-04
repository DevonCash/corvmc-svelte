<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getAudiences } from '$lib/remote/marketing.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import { CreateAudienceAction } from '$lib/components/shared/actions';
	import Badge from '$lib/components/shared/Badge.svelte';
	import { formatDate } from '$lib/utils/format';

	let audiences = $derived(await getAudiences());
</script>

<PageHeader title="Audiences" subtitle="Marketing">
	<CreateAudienceAction
		onsuccess={(result) => {
			const r = result as { audienceId?: string };
			if (r?.audienceId) goto(resolve(`/staff/marketing/audiences/${r.audienceId}`));
		}}
	/>
</PageHeader>
<PageContent>
	{#if audiences.length === 0}
		<p class="text-center opacity-60 py-8">
			No audiences yet. Create one to start building your email lists.
		</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="table">
				<thead>
					<tr>
						<th>Name</th>
						<th class="w-px">Subscribers</th>
						<th class="w-px">Opt-in</th>
						<th class="w-px">Created</th>
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
							<td class="w-px">{a.subscriberCount}</td>
							<td class="w-px">
								{#if a.allowOptIn}
									<Badge variant="success">Public</Badge>
								{:else}
									<Badge variant="ghost">Staff only</Badge>
								{/if}
							</td>
							<td class="w-px">{formatDate(a.createdAt)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</PageContent>
