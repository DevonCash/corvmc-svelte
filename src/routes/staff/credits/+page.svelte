<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Pagination from '$lib/components/shared/Pagination.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import MemberLink from '$lib/components/shared/MemberLink.svelte';
	import { getStaffCredits } from '$lib/remote/users.remote';
	import { formatDateTime } from '$lib/utils/format';

	const sourceLabels: Record<string, string> = {
		monthly_allocation: 'Monthly Allocation',
		checkout: 'Checkout',
		refund: 'Refund',
		cancelled: 'Cancelled',
		admin_adjustment: 'Admin Adjustment'
	};

	let search = $state('');
	let creditType = $state('');
	let source = $state('');
	let dateFrom = $state('');
	let dateTo = $state('');
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
		creditType: creditType || undefined,
		source: source || undefined,
		from: dateFrom || undefined,
		to: dateTo || undefined,
		page
	});

	let result = $derived(getStaffCredits(filters));

	function hasActiveFilters(): boolean {
		return !!(searchDebounced || creditType || source || dateFrom || dateTo);
	}

	function clearFilters() {
		search = '';
		searchDebounced = '';
		creditType = '';
		source = '';
		dateFrom = '';
		dateTo = '';
		page = 1;
	}
</script>

<PageHeader title="Credit Transactions" />
<PageContent>
	<div class="flex flex-wrap items-end gap-2 mb-4">
		<input
			type="text"
			class="input input-bordered input-sm"
			placeholder="Search name or email..."
			value={search}
			oninput={onSearchInput}
		/>
		<select
			class="select select-bordered select-sm"
			value={creditType}
			onchange={(e) => {
				creditType = (e.currentTarget as HTMLSelectElement).value;
				page = 1;
			}}
		>
			<option value="">All types</option>
			<option value="free_hours">Free Hours</option>
			<option value="equipment_credits">Equipment Credits</option>
		</select>
		<select
			class="select select-bordered select-sm"
			value={source}
			onchange={(e) => {
				source = (e.currentTarget as HTMLSelectElement).value;
				page = 1;
			}}
		>
			<option value="">All sources</option>
			<option value="monthly_allocation">Monthly Allocation</option>
			<option value="checkout">Checkout</option>
			<option value="refund">Refund</option>
			<option value="cancelled">Cancelled</option>
			<option value="admin_adjustment">Admin Adjustment</option>
		</select>
		<input
			type="date"
			class="input input-bordered input-sm"
			bind:value={dateFrom}
			onchange={() => {
				page = 1;
			}}
		/>
		<input
			type="date"
			class="input input-bordered input-sm"
			bind:value={dateTo}
			onchange={() => {
				page = 1;
			}}
		/>
		{#if hasActiveFilters()}
			<button class="btn btn-ghost btn-sm" onclick={clearFilters}>Clear</button>
		{/if}
	</div>

	{#await result}
		<div class="flex justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:then { rows: transactions, pagination }}
		{#if transactions.length === 0}
			<p class="text-center opacity-60 py-8">No credit transactions found</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th>Date</th>
							<th>Member</th>
							<th>Type</th>
							<th class="w-px">Amount</th>
							<th class="w-px">Balance</th>
							<th>Source</th>
							<th>Description</th>
						</tr>
					</thead>
					<tbody>
						{#each transactions as t (t.id)}
							<tr class="hover">
								<td>{formatDateTime(new Date(t.createdAt))}</td>
								<td onclick={(e) => e.stopPropagation()}>
									<MemberLink
										member={{ name: t.userName ?? '', email: t.userEmail, userId: t.userId }}
									/>
								</td>
								<td
									><StatusBadge
										status={t.creditType === 'free_hours' ? 'Free Hours' : 'Equipment'}
									/></td
								>
								<td class="w-px">
									<span
										class={t.amount > 0 ? 'text-success font-medium' : 'text-error font-medium'}
									>
										{t.amount > 0 ? '+' : ''}{t.amount}
									</span>
								</td>
								<td class="w-px">{t.balanceAfter}</td>
								<td>{sourceLabels[t.source] ?? t.source}</td>
								<td>{t.description}</td>
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
