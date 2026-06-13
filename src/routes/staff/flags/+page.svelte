<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Pagination from '$lib/components/shared/Pagination.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import { formatDateTime } from '$lib/utils/format';
	import { getFlagsQueue } from '$lib/remote/flags.remote';

	const flagStatuses = ['pending', 'resolved', 'dismissed'] as const;

	const entityLabels: Record<string, string> = {
		member_profile: 'Member',
		band_profile: 'Band'
	};

	let search = $state('');
	let statusFilter = $state<'pending' | 'resolved' | 'dismissed' | ''>('pending');
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
		status: (statusFilter || undefined) as (typeof flagStatuses)[number] | undefined,
		page
	});

	let result = $derived(getFlagsQueue(filters));

	function hasActiveFilters(): boolean {
		return !!(searchDebounced || statusFilter !== 'pending');
	}

	function clearFilters() {
		search = '';
		searchDebounced = '';
		statusFilter = 'pending';
		page = 1;
	}
</script>

<PageHeader title="Content Flags" />
<PageContent>
	<div class="flex flex-wrap items-end gap-2 mb-4">
		<input
			type="text"
			class="input input-bordered input-sm"
			placeholder="Search reason..."
			value={search}
			oninput={onSearchInput}
		/>
		<select
			class="select select-bordered select-sm"
			value={statusFilter}
			onchange={(e) => {
				statusFilter = (e.currentTarget as HTMLSelectElement).value as typeof statusFilter;
				page = 1;
			}}
		>
			<option value="">All statuses</option>
			{#each flagStatuses as s (s)}
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
	{:then { rows: flags, pagination }}
		{#if flags.length === 0}
			<p class="text-center opacity-60 py-8">No flags found</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th class="w-px">Type</th>
							<th>Content</th>
							<th>Reason</th>
							<th>Reported by</th>
							<th class="w-px">Status</th>
							<th class="w-px">Reported</th>
						</tr>
					</thead>
					<tbody>
						{#each flags as f (f.id)}
							<tr
								class="hover cursor-pointer"
								onclick={() => (window.location.href = `/staff/flags/${f.id}`)}
							>
								<td class="w-px text-sm">{entityLabels[f.entityType] ?? f.entityType}</td>
								<td class="font-medium">{f.entityLabel}</td>
								<td class="max-w-xs truncate">{f.reason}</td>
								<td class="text-sm">{f.reportedByName}</td>
								<td class="w-px"><StatusBadge status={f.status} label /></td>
								<td class="w-px whitespace-nowrap text-sm">{formatDateTime(f.createdAt)}</td>
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
