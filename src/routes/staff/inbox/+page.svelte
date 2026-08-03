<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import DataList from '$lib/components/shared/DataList.svelte';
	import Table from '$lib/components/shared/Table.svelte';
	import FilterBar from '$lib/components/shared/FilterBar.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import { rowLink } from '$lib/actions/row-link';
	import { resolve } from '$app/paths';
	import { relativeDay } from '$lib/utils/format';
	import { inboxChannels, inboxThreadStatuses } from '$lib/config';
	import { getInboxThreads, getInboxEnabledChannels } from '$lib/remote/inbox.remote';
	import {
		IconMail,
		IconMessageCircle,
		IconWorld,
		IconBrandInstagram,
		IconBrandFacebook
	} from '@tabler/icons-svelte';

	const channelIcons: Record<string, typeof IconMail> = {
		email: IconMail,
		sms: IconMessageCircle,
		web: IconWorld,
		instagram: IconBrandInstagram,
		messenger: IconBrandFacebook
	};

	const channelLabels: Record<string, string> = {
		email: 'Email',
		sms: 'SMS',
		web: 'Web',
		instagram: 'Instagram',
		messenger: 'Messenger'
	};

	// `searchText`, not `search`: FilterBar's always-visible slot is a snippet
	// named `search`, and a snippet shadows a same-named script binding.
	let searchText = $state('');
	let statusFilter = $state('');
	let channelFilter = $state('');
	let page = $state(1);

	let searchDebounced = $state('');
	let searchTimer: ReturnType<typeof setTimeout>;
	function onSearchInput(e: Event) {
		searchText = (e.target as HTMLInputElement).value;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			searchDebounced = searchText;
			page = 1;
		}, 300);
	}

	let filters = $derived({
		search: searchDebounced || undefined,
		status: (statusFilter || undefined) as (typeof inboxThreadStatuses)[number] | undefined,
		channel: (channelFilter || undefined) as (typeof inboxChannels)[number] | undefined,
		page
	});

	let result = $derived(getInboxThreads(filters));
	let enabledChannels = $derived(getInboxEnabledChannels());

	const activeFilterCount = $derived(
		(searchDebounced ? 1 : 0) + (statusFilter ? 1 : 0) + (channelFilter ? 1 : 0)
	);

	function clearFilters() {
		searchText = '';
		searchDebounced = '';
		statusFilter = '';
		channelFilter = '';
		page = 1;
	}
</script>

<PageHeader title="Inbox" />
<PageContent>
	<FilterBar activeCount={activeFilterCount} onclear={clearFilters}>
		{#snippet search()}
			<input
				type="text"
				class="input input-bordered input-sm w-full"
				placeholder="Search..."
				value={searchText}
				oninput={onSearchInput}
			/>
		{/snippet}
		{#await enabledChannels then channels}
			<select
				class="select select-bordered select-sm"
				aria-label="Channel"
				value={channelFilter}
				onchange={(e) => {
					channelFilter = (e.currentTarget as HTMLSelectElement).value;
					page = 1;
				}}
			>
				<option value="">All channels</option>
				{#each channels as ch (ch)}
					<option value={ch}>{channelLabels[ch]}</option>
				{/each}
			</select>
		{/await}
		<select
			class="select select-bordered select-sm"
			aria-label="Status"
			value={statusFilter}
			onchange={(e) => {
				statusFilter = (e.currentTarget as HTMLSelectElement).value;
				page = 1;
			}}
		>
			<option value="">All statuses</option>
			{#each inboxThreadStatuses as s (s)}
				<option value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
			{/each}
		</select>
	</FilterBar>

	<DataList {result} empty="No conversations found" onpage={(p) => (page = p)}>
		{#snippet children(threads)}
			<Table>
				{#snippet head()}
					<th class="w-px"><span class="sr-only">Channel</span></th>
					<th>Conversation</th>
					<th class="w-px">Status</th>
					<th class="col-extra">Assigned</th>
					<th class="col-support whitespace-nowrap">Last message</th>
				{/snippet}

				{#each threads as t (t.id)}
					{@const ChannelIcon = channelIcons[t.channel] ?? IconWorld}
					{@const href = resolve(`/staff/inbox/${t.id}`)}
					<tr class="hover cursor-pointer" use:rowLink={href}>
						<td class="w-px">
							<span class="tooltip" data-tip={channelLabels[t.channel]}>
								<ChannelIcon size={18} />
							</span>
						</td>

						<!--
							Contact, subject and preview were three columns' worth of content
							across two columns; as one cell they fit a phone. `min-w-0` +
							`truncate` is what keeps the preview from forcing the table wide —
							that overflow clipped the timestamp column even at 1280.
						-->
						<td class="cell-primary">
							<div class="flex min-w-0 items-baseline gap-2">
								<!-- The contact is the identifier, so it takes its full width and
								     the subject absorbs the truncation. -->
								<a {href} class="shrink-0 font-medium hover:underline">
									{t.contactName ?? t.contactEmail ?? t.contactPhone ?? '—'}
								</a>
								{#if t.subject}
									<span class="truncate text-sm opacity-70">{t.subject}</span>
								{/if}
							</div>
							{#if t.preview}
								<div class="truncate text-sm opacity-60">{t.preview}</div>
							{/if}
						</td>

						<td class="w-px"><StatusBadge status={t.status} label /></td>
						<td class="col-extra text-sm">{t.assignedToName ?? '—'}</td>
						<td class="col-support text-sm whitespace-nowrap">
							{t.lastMessageAt ? relativeDay(t.lastMessageAt) : '—'}
						</td>
					</tr>
				{/each}
			</Table>
		{/snippet}
	</DataList>
</PageContent>
