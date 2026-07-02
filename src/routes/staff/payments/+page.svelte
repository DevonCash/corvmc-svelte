<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Pagination from '$lib/components/shared/Pagination.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import PaymentMethodIcon from '$lib/components/shared/PaymentMethodIcon.svelte';
	import CopyableId from '$lib/components/shared/CopyableId.svelte';
	import MemberLink from '$lib/components/shared/MemberLink.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import { getStaffPayments } from '$lib/remote/users.remote';
	import { formatDateTime, formatCents } from '$lib/utils/format';

	let search = $state('');
	let method = $state('');
	let status = $state('');
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
		method: method || undefined,
		status: status || undefined,
		from: dateFrom || undefined,
		to: dateTo || undefined,
		page
	});

	let result = $derived(getStaffPayments(filters));

	function hasActiveFilters(): boolean {
		return !!(searchDebounced || method || status || dateFrom || dateTo);
	}

	function clearFilters() {
		search = '';
		searchDebounced = '';
		method = '';
		status = '';
		dateFrom = '';
		dateTo = '';
		page = 1;
	}
</script>

<PageHeader title="Payments" />
<PageContent>
	<p class="text-sm text-base-content/60 mb-4">
		Cash and credit-settled payments only — card payments (tickets, online reservation payments) are
		recorded in the Stripe dashboard.
	</p>
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
			value={method}
			onchange={(e) => {
				method = (e.currentTarget as HTMLSelectElement).value;
				page = 1;
			}}
		>
			<option value="">All methods</option>
			<option value="Cash">Cash</option>
			<option value="Credits">Credits</option>
		</select>
		<select
			class="select select-bordered select-sm"
			value={status}
			onchange={(e) => {
				status = (e.currentTarget as HTMLSelectElement).value;
				page = 1;
			}}
		>
			<option value="">All statuses</option>
			<option value="completed">Completed</option>
			<option value="refunded">Refunded</option>
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
	{:then { rows: payments, pagination }}
		{#if payments.length === 0}
			<p class="text-center opacity-60 py-8">No payment records found</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th>Date</th>
							<th>Member</th>
							<th>Amount</th>
							<th class="w-px">Method</th>
							<th class="w-px">Status</th>
							<th>Record</th>
						</tr>
					</thead>
					<tbody>
						{#each payments as p (p.id)}
							<tr class="hover">
								<td>{formatDateTime(new Date(p.paidAt))}</td>
								<td onclick={(e) => e.stopPropagation()}>
									<MemberLink
										member={{ name: p.userName ?? '', email: p.userEmail, userId: p.userId }}
									/>
								</td>
								<td><span class="font-medium">{formatCents(p.amountCents)}</span></td>
								<td class="w-px"><PaymentMethodIcon method={p.paymentMethod} /></td>
								<td class="w-px"><StatusBadge status={p.status} /></td>
								<td>
									<div class="flex items-center gap-2">
										<CopyableId value={p.id} label="Stripe" />
										{#if p.reservationId}
											<Button href="/staff/reservations/{p.reservationId}" class="btn-ghost btn-xs">
												View reservation
											</Button>
										{/if}
									</div>
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
