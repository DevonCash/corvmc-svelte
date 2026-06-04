<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Pagination from '$lib/components/shared/Pagination.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import { formatDate, formatCents } from '$lib/utils/format';
	import { loanStatuses } from '$lib/config';
	import { CreateLoanAction } from '$lib/components/shared/actions';
	import { getStaffLoans } from '$lib/remote/equipment.remote';

	let search = $state('');
	let statusFilter = $state('');
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
		status: statusFilter || undefined,
		page
	});

	let result = $derived(getStaffLoans(filters));

	function hasActiveFilters(): boolean {
		return !!(searchDebounced || statusFilter);
	}

	function clearFilters() {
		search = '';
		searchDebounced = '';
		statusFilter = '';
		page = 1;
	}
</script>

<PageHeader title="Equipment Loans" backHref="/staff/equipment">
	<CreateLoanAction />
</PageHeader>
<PageContent>
	<div class="flex flex-wrap items-end gap-2 mb-4">
		<input
			type="text"
			class="input input-bordered input-sm"
			placeholder="Search by member..."
			value={search}
			oninput={onSearchInput}
		/>
		<select
			class="select select-bordered select-sm"
			value={statusFilter}
			onchange={(e) => {
				statusFilter = (e.currentTarget as HTMLSelectElement).value;
				page = 1;
			}}
		>
			<option value="">All statuses</option>
			{#each loanStatuses as s (s)}
				<option value={s}>{s}</option>
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
	{:then { rows: loans, pagination }}
		{#if loans.length === 0}
			<p class="text-center opacity-60 py-8">No loans found</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th>Member</th>
							<th>Equipment</th>
							<th class="w-px">Status</th>
							<th class="w-px">Requested</th>
							<th class="w-px">Due</th>
							<th class="w-px">Charge</th>
						</tr>
					</thead>
					<tbody>
						{#each loans as l (l.id)}
							<tr
								class="hover cursor-pointer"
								onclick={() => (window.location.href = `/staff/equipment/loans/${l.id}`)}
							>
								<td>{l.userName}</td>
								<td>{l.equipmentName ?? '(free-form request)'}</td>
								<td class="w-px">
									<StatusBadge status={l.status} />
									{#if l.isOverdue}
										<Badge variant="error" size="xs" class="ml-1">Overdue</Badge>
									{/if}
								</td>
								<td class="w-px">{formatDate(l.requestedPickupDate)}</td>
								<td class="w-px">{l.dueDate ? formatDate(l.dueDate) : '—'}</td>
								<td class="w-px"
									>{l.totalChargeCents != null ? formatCents(l.totalChargeCents) : '—'}</td
								>
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
