<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Pagination from '$lib/components/shared/Pagination.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import { formatDateTime } from '$lib/utils/format';
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

	let search = $state('');
	let statusFilter = $state('');
	let channelFilter = $state('');
	let page = $state(1);

	let searchDebounced = $state('');
	let searchTimer: ReturnType<typeof setTimeout>;
	function onSearchInput(e: Event) {
		search = (e.target as HTMLInputElement).value;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			searchDebounced = search;
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

	function hasActiveFilters(): boolean {
		return !!(searchDebounced || statusFilter || channelFilter);
	}

	function clearFilters() {
		search = '';
		searchDebounced = '';
		statusFilter = '';
		channelFilter = '';
		page = 1;
	}
</script>

<PageHeader title="Inbox" />
<PageContent>
	<div class="flex flex-wrap items-end gap-2 mb-4">
		<input
			type="text"
			class="input input-bordered input-sm"
			placeholder="Search..."
			value={search}
			oninput={onSearchInput}
		/>
		{#await enabledChannels then channels}
			<select
				class="select select-bordered select-sm"
				value={channelFilter}
				onchange={(e) => {
					channelFilter = (e.currentTarget as HTMLSelectElement).value;
					page = 1;
				}}
			>
				<option value="">All channels</option>
				{#each channels as ch}
					<option value={ch}>{channelLabels[ch]}</option>
				{/each}
			</select>
		{/await}
		<select
			class="select select-bordered select-sm"
			value={statusFilter}
			onchange={(e) => {
				statusFilter = (e.currentTarget as HTMLSelectElement).value;
				page = 1;
			}}
		>
			<option value="">All statuses</option>
			{#each inboxThreadStatuses as s}
				<option value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
			{/each}
		</select>
		{#if hasActiveFilters()}
			<button class="btn btn-ghost btn-sm" onclick={clearFilters}>Clear</button>
		{/if}
	</div>

	{#await result}
		<div class="flex justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:then { rows: threads, pagination }}
		{#if threads.length === 0}
			<p class="text-center opacity-60 py-8">No conversations found</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th class="w-px">Channel</th>
							<th>Contact</th>
							<th>Subject / Preview</th>
							<th class="w-px">Status</th>
							<th>Assigned</th>
							<th class="w-px">Last Message</th>
						</tr>
					</thead>
					<tbody>
						{#each threads as t (t.id)}
							{@const ChannelIcon = channelIcons[t.channel] ?? IconWorld}
							<tr
								class="hover cursor-pointer"
								onclick={() => (window.location.href = `/staff/inbox/${t.id}`)}
							>
								<td class="w-px">
									<span class="tooltip" data-tip={channelLabels[t.channel]}>
										<ChannelIcon size={18} />
									</span>
								</td>
								<td>
									<div class="font-medium">
										{t.contactName ?? t.contactEmail ?? t.contactPhone ?? '—'}
									</div>
									{#if t.contactEmail && t.contactName}
										<div class="text-xs opacity-60">{t.contactEmail}</div>
									{/if}
								</td>
								<td>
									{#if t.subject}
										<div class="font-medium text-sm">{t.subject}</div>
									{/if}
									{#if t.preview}
										<div class="text-xs opacity-60 max-w-xs truncate">{t.preview}</div>
									{/if}
								</td>
								<td class="w-px"><StatusBadge status={t.status} label /></td>
								<td class="text-sm">{t.assignedToName ?? '—'}</td>
								<td class="w-px whitespace-nowrap text-sm">
									{t.lastMessageAt ? formatDateTime(t.lastMessageAt) : '—'}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<Pagination
				page={pagination.page}
				totalPages={pagination.totalPages}
				onpage={(p) => (page = p)}
			/>
		{/if}
	{/await}
</PageContent>
