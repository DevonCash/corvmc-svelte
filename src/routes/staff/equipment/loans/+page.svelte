<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import DataList from '$lib/components/shared/DataList.svelte';
	import Table from '$lib/components/shared/Table.svelte';
	import FilterBar from '$lib/components/shared/FilterBar.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import { rowLink } from '$lib/actions/row-link';
	import { resolve } from '$app/paths';
	import { formatDateShort, formatCents, titleCase } from '$lib/utils/format';
	import { loanStatuses } from '$lib/config';
	import { CreateLoanAction } from '$lib/components/shared/actions';
	import { getStaffLoans } from '$lib/remote/equipment.remote';

	// `searchText`, not `search`: FilterBar's always-visible slot is a snippet
	// named `search`, and a snippet shadows a same-named script binding.
	let searchText = $state('');
	let statusFilter = $state('');
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
		status: statusFilter || undefined,
		page
	});

	let result = $derived(getStaffLoans(filters));

	const activeFilterCount = $derived((searchDebounced ? 1 : 0) + (statusFilter ? 1 : 0));

	function clearFilters() {
		searchText = '';
		searchDebounced = '';
		statusFilter = '';
		page = 1;
	}
</script>

<PageHeader title="Equipment Loans" backHref="/staff/equipment">
	<CreateLoanAction />
</PageHeader>
<PageContent>
	<FilterBar activeCount={activeFilterCount} onclear={clearFilters}>
		{#snippet search()}
			<input
				type="text"
				class="input input-bordered input-sm w-full"
				placeholder="Search by member..."
				value={searchText}
				oninput={onSearchInput}
			/>
		{/snippet}
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
			{#each loanStatuses as s (s)}
				<option value={s}>{titleCase(s)}</option>
			{/each}
		</select>
	</FilterBar>

	<DataList {result} empty="No loans found" onpage={(p) => (page = p)}>
		{#snippet children(loans)}
			<Table>
				{#snippet head()}
					<th class="w-px"><span class="sr-only">Status</span></th>
					<th>Loan</th>
					<th class="col-support whitespace-nowrap">Due</th>
					<th class="col-extra whitespace-nowrap">Requested</th>
					<th class="col-support cell-num">Charge</th>
				{/snippet}

				{#each loans as l (l.id)}
					{@const href = resolve(`/staff/equipment/loans/${l.id}`)}
					<tr class="hover cursor-pointer" use:rowLink={href}>
						<td class="w-px">
							<div class="flex items-center gap-1">
								<StatusBadge status={l.status} />
								{#if l.isOverdue}
									<Badge variant="error" size="xs">Overdue</Badge>
								{/if}
							</div>
						</td>
						<!-- Equipment is what was borrowed; the member is its qualifier. -->
						<td class="cell-primary">
							<a {href} class="block truncate font-medium hover:underline">
								{l.equipmentName ?? '(free-form request)'}
							</a>
							<div class="truncate text-sm opacity-60">{l.userName}</div>
						</td>
						<td class="col-support whitespace-nowrap">
							{l.dueDate ? formatDateShort(l.dueDate) : '—'}
						</td>
						<td class="col-extra whitespace-nowrap">
							{formatDateShort(l.requestedPickupDate)}
						</td>
						<td class="col-support cell-num">
							{l.totalChargeCents != null ? formatCents(l.totalChargeCents) : '—'}
						</td>
					</tr>
				{/each}
			</Table>
		{/snippet}
	</DataList>
</PageContent>
