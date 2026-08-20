<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import DataList from '$lib/components/shared/DataList.svelte';
	import Table from '$lib/components/shared/Table.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import { EntityIdentity } from '$lib/components/shared/entity';
	import CreateModal from './CreateModal.svelte';
	import { rowLink } from '$lib/actions/row-link';
	import { resolve } from '$app/paths';
	import { relativeDay } from '$lib/utils/format';
	import { getMyMessages } from '$lib/remote/direct-messages.remote';

	let pageNumber = $state(1);

	const result = $derived(getMyMessages({ page: pageNumber }));
</script>

<PageHeader title="Messages" subtitle="Conversations with CorvMC staff and other members">
	<CreateModal />
</PageHeader>
<PageContent>
	<DataList
		{result}
		emptyTitle="No messages yet"
		empty="Start a conversation and it will appear here."
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
								<span class="bg-primary block size-2 rounded-full" title="Unread"></span>
							{/if}
						</td>

						<td class="cell-primary">
							<!--
								A wrapper here is safe where `cell-primary` normally forbids one:
								the truncating element is the preview below, which stays a direct
								child. The badge has to sit beside the name, and a bare `sm`
								identity has no slot for one.
							-->
							<div class="flex min-w-0 items-center gap-2">
								<EntityIdentity ref={c.ref} class={c.unread ? 'font-bold' : ''} />
								<!-- A request is in the list so it is found, but is never in the
								     unread count — see countDirectUnread. -->
								{#if c.pending}
									<span class="badge badge-sm badge-warning shrink-0">Request</span>
								{/if}
							</div>
							{#if c.preview}
								<div class="truncate text-muted">{c.preview}</div>
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
