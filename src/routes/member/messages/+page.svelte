<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import DataList from '$lib/components/shared/DataList.svelte';
	import Table from '$lib/components/shared/Table.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import CreateModal from './CreateModal.svelte';
	import { rowLink } from '$lib/actions/row-link';
	import { resolve } from '$app/paths';
	import { relativeDay } from '$lib/utils/format';
	import { getMyConversations } from '$lib/remote/inbox.remote';

	let pageNumber = $state(1);

	const result = $derived(getMyConversations({ page: pageNumber }));
</script>

<PageHeader title="Messages" subtitle="Questions, requests, and anything else for CorvMC staff">
	<CreateModal />
</PageHeader>
<PageContent>
	<DataList
		{result}
		emptyTitle="No messages yet"
		empty="Start a conversation and staff will get back to you here."
		onpage={(p) => (pageNumber = p)}
	>
		{#snippet children(conversations)}
			<Table>
				{#snippet head()}
					<th class="w-px"><span class="sr-only">Unread</span></th>
					<th>Conversation</th>
					<th class="w-px">Status</th>
					<th class="col-support whitespace-nowrap">Last message</th>
				{/snippet}

				{#each conversations as c (c.id)}
					{@const href = resolve(`/member/messages/${c.id}`)}
					<tr class="hover cursor-pointer" use:rowLink={href}>
						<td class="w-px">
							{#if c.unread}
								<span class="bg-primary block size-2 rounded-full" title="Unread reply"></span>
							{/if}
						</td>

						<td class="cell-primary">
							<a {href} class="font-medium hover:underline" class:font-bold={c.unread}>
								{c.subject ?? 'Conversation'}
							</a>
							{#if c.preview}
								<div class="truncate text-sm opacity-60">{c.preview}</div>
							{/if}
						</td>

						<td class="w-px"><StatusBadge status={c.status} label /></td>
						<td class="col-support text-sm whitespace-nowrap">
							{c.lastMessageAt ? relativeDay(c.lastMessageAt) : '—'}
						</td>
					</tr>
				{/each}
			</Table>
		{/snippet}
	</DataList>
</PageContent>
