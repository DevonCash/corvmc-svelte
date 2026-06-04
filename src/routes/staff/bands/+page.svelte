<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Pagination from '$lib/components/shared/Pagination.svelte';
	import MemberLink from '$lib/components/shared/MemberLink.svelte';
	import { CreateBandAction } from '$lib/components/shared/actions';
	import { getStaffBands } from '$lib/remote/bands.remote';
	import { formatDate } from '$lib/utils/format';

	let search = $state('');
	let status = $state<'active' | 'deactivated' | ''>('');
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
		status: status || undefined,
		page
	});

	let result = $derived(getStaffBands(filters));

	function hasActiveFilters(): boolean {
		return !!(searchDebounced || status);
	}

	function clearFilters() {
		search = '';
		searchDebounced = '';
		status = '';
		page = 1;
	}
</script>

<PageHeader title="Bands">
	<CreateBandAction />
</PageHeader>
<PageContent>
	<div class="flex flex-wrap items-end gap-2 mb-4">
		<input
			type="text"
			class="input input-bordered input-sm"
			placeholder="Search by name..."
			value={search}
			oninput={onSearchInput}
		/>
		<select
			class="select select-bordered select-sm"
			value={status}
			onchange={(e) => {
				status = (e.currentTarget as HTMLSelectElement).value as typeof status;
				page = 1;
			}}
		>
			<option value="">All statuses</option>
			<option value="active">Active</option>
			<option value="deactivated">Deactivated</option>
		</select>
		{#if hasActiveFilters()}
			<button class="btn btn-ghost btn-sm" onclick={clearFilters}>Clear</button>
		{/if}
	</div>

	{#await result}
		<div class="flex justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:then { rows: bands, pagination }}
		{#if bands.length === 0}
			<p class="text-center opacity-60 py-8">No bands found</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th class="w-px"></th>
							<th>Name</th>
							<th>Owner</th>
							<th>Members</th>
							<th>Created</th>
						</tr>
					</thead>
					<tbody>
						{#each bands as b (b.id)}
							<tr
								class="hover cursor-pointer"
								onclick={() => (window.location.href = `/staff/bands/${b.id}`)}
							>
								<td class="w-px">
									<StatusBadge status={b.deletedAt ? 'deactivated' : 'active'} />
								</td>
								<td>{b.name}</td>
								<td onclick={(e) => e.stopPropagation()}>
									<MemberLink member={{ name: b.ownerName, userId: b.ownerId }} />
								</td>
								<td>{b.memberCount}</td>
								<td>{formatDate(b.createdAt)}</td>
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
