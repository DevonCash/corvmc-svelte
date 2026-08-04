<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import DataList from '$lib/components/shared/DataList.svelte';
	import Table from '$lib/components/shared/Table.svelte';
	import FilterBar from '$lib/components/shared/FilterBar.svelte';
	import TabBar from '$lib/components/shared/TabBar.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Select from '$lib/components/shared/Form/Select.svelte';
	import { rowLink } from '$lib/actions/row-link';
	import { resolve } from '$app/paths';
	import { relativeDay } from '$lib/utils/format';
	import { inboxChannels } from '$lib/config';
	import {
		getInboxThreads,
		getInboxThreadCounts,
		getInboxEnabledChannels,
		getAssignableStaff
	} from '$lib/remote/inbox.remote';
	import { channelIcon, channelLabel } from '$lib/components/inbox/channels';
	import { IconWorld } from '@tabler/icons-svelte';

	type StatusView = 'open' | 'snoozed' | 'resolved' | 'all';
	const statusViews: StatusView[] = ['open', 'snoozed', 'resolved', 'all'];

	// Filter state is seeded from the query string and mirrored back into it, so
	// opening a thread and pressing back lands on the same filtered view instead
	// of page 1 of the default one. The state is local rather than read back out
	// of `page.url` so a filter change re-renders immediately instead of waiting
	// on the navigation that mirrors it.
	//
	// The mirror replaces the history entry rather than pushing one: tweaking a
	// filter should not sit between the list and the thread you open from it.
	const initial = page.url.searchParams;
	const parseStatus = (raw: string | null): StatusView =>
		statusViews.includes(raw as StatusView) ? (raw as StatusView) : 'open';

	let statusView = $state(parseStatus(initial.get('status')));
	let channelFilter = $state(initial.get('channel') ?? '');
	let assignedFilter = $state(initial.get('assigned') ?? '');
	// `searchText` (not `search`): FilterBar's always-visible slot is a snippet
	// named `search`, and a snippet shadows a same-named script binding.
	let searchText = $state(initial.get('q') ?? '');
	let searchQuery = $state(initial.get('q') ?? '');
	let pageNumber = $state(Number(initial.get('page') ?? '1') || 1);

	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	function onSearchInput(e: Event) {
		searchText = (e.target as HTMLInputElement).value;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			searchQuery = searchText;
			pageNumber = 1;
		}, 300);
	}

	$effect(() => () => clearTimeout(searchTimer));

	// Writes the URL, never state — the filters above stay the source of truth.
	// `goto(..., { replaceState })` rather than `replaceState()`: the latter only
	// rewrites the address bar, and the router then overwrites that entry with
	// its own record on the next navigation, so back from a thread landed on the
	// unfiltered list.
	$effect(() => {
		// Pairs rather than URLSearchParams: the lint rule bans mutable instances of
		// it, and defaults are simply left out so a clean view has a clean URL.
		const pairs: [string, string][] = [];
		if (statusView !== 'open') pairs.push(['status', statusView]);
		if (channelFilter) pairs.push(['channel', channelFilter]);
		if (assignedFilter) pairs.push(['assigned', assignedFilter]);
		if (searchQuery) pairs.push(['q', searchQuery]);
		if (pageNumber > 1) pairs.push(['page', String(pageNumber)]);

		const search = pairs.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
		const href = `${resolve('/staff/inbox')}${search ? `?${search}` : ''}`;
		if (location.pathname + location.search !== href) {
			void goto(href, { replaceState: true, noScroll: true, keepFocus: true });
		}
	});

	let filters = $derived({
		search: searchQuery || undefined,
		status: statusView === 'all' ? undefined : statusView,
		channel: (channelFilter || undefined) as (typeof inboxChannels)[number] | undefined,
		assigned: assignedFilter || undefined,
		page: pageNumber
	});

	let result = $derived(getInboxThreads(filters));
	let counts = $derived(getInboxThreadCounts());
	let enabledChannels = $derived(getInboxEnabledChannels());
	let staffUsers = $derived(getAssignableStaff());

	// The status view is a view, not a filter — it always has a value, so counting
	// it would leave "Clear" permanently offered.
	const activeFilterCount = $derived(
		(searchQuery ? 1 : 0) + (channelFilter ? 1 : 0) + (assignedFilter ? 1 : 0)
	);

	function clearFilters() {
		clearTimeout(searchTimer);
		searchText = '';
		searchQuery = '';
		channelFilter = '';
		assignedFilter = '';
		pageNumber = 1;
	}
</script>

<PageHeader title="Inbox" />
<PageContent>
	{#await counts then c}
		<!-- The four tabs are wider than a phone; without this the last one is
		     clipped off the edge with no way to reach it. -->
		<div class="mb-4 overflow-x-auto pb-1">
			<TabBar
				class="w-max"
				tabs={[
					{ key: 'open', label: 'Open', badge: c.open },
					{ key: 'snoozed', label: 'Snoozed', badge: c.snoozed },
					{ key: 'resolved', label: 'Resolved', badge: c.resolved },
					{ key: 'all', label: 'All', badge: c.all }
				]}
				active={statusView}
				onchange={(key) => {
					statusView = key as StatusView;
					pageNumber = 1;
				}}
			/>
		</div>
	{/await}

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
			<Select
				class="select-bordered select-sm"
				aria-label="Channel"
				value={channelFilter}
				onchange={(e: Event) => {
					channelFilter = (e.currentTarget as HTMLSelectElement).value;
					pageNumber = 1;
				}}
			>
				<option value="">All channels</option>
				<!-- Enabled channels plus whatever the current filter names, so a thread
				     from a since-disabled channel stays reachable. -->
				{#each [...new Set([...channels, ...(channelFilter ? [channelFilter] : [])])] as ch (ch)}
					<option value={ch}>{channelLabel(ch)}</option>
				{/each}
			</Select>
		{/await}
		{#await staffUsers then staff}
			<Select
				class="select-bordered select-sm"
				aria-label="Assigned to"
				value={assignedFilter}
				onchange={(e: Event) => {
					assignedFilter = (e.currentTarget as HTMLSelectElement).value;
					pageNumber = 1;
				}}
			>
				<option value="">Anyone</option>
				<option value="mine">Assigned to me</option>
				<option value="unassigned">Unassigned</option>
				{#each staff as s (s.id)}
					<option value={s.id}>{s.name}</option>
				{/each}
			</Select>
		{/await}
	</FilterBar>

	<DataList
		{result}
		empty={statusView === 'open' ? 'Nothing open — the queue is clear.' : 'No conversations found'}
		onpage={(p) => (pageNumber = p)}
	>
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
					{@const ChannelIcon = channelIcon(t.channel) ?? IconWorld}
					{@const href = resolve(`/staff/inbox/${t.id}`)}
					<tr class="hover cursor-pointer" use:rowLink={href}>
						<td class="w-px">
							<span class="tooltip" data-tip={channelLabel(t.channel)}>
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
