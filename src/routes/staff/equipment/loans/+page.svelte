<script lang="ts">
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import * as Filter from '$lib/components/shared/Table/Filter';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { formatDate, formatCents } from '$lib/utils/format';
	import { loanStatuses } from '$lib/types/equipment';
	import { searchMembers, getEquipmentOptions, createLoanForMember } from './data.remote';
	import type { StaffEquipmentLoansResponse } from '$lib/types/api';

	let { data }: { data: StaffEquipmentLoansResponse } = $props();

	// New loan state
	function buildPageHref(page: number): string {
		const params = new URLSearchParams();
		if (data.filters.search) params.set('q', data.filters.search);
		if (data.filters.status) params.set('status', data.filters.status);
		params.set('page', String(page));
		return `/staff/equipment/loans?${params.toString()}`;
	}

	let loanQuery = $state('');
	let loanUserId = $state('');
	let loanUserName = $state('');
	let loanEquipmentId = $state('');
	let loanQuantity = $state(1);
	let loanPickupDate = $state('');
	let loanEstimatedReturnDate = $state('');
	let loanNotes = $state('');
	let memberResults = $state<{ id: string; name: string; email: string }[]>([]);
	let equipmentOptions = $state<{ id: string; name: string }[]>([]);
	let searching = $state(false);

	async function handleMemberSearch() {
		if (loanQuery.length < 2) { memberResults = []; return; }
		searching = true;
		try {
			memberResults = await searchMembers(loanQuery);
		} finally {
			searching = false;
		}
	}

	function selectMember(u: { id: string; name: string }) {
		loanUserId = u.id;
		loanUserName = u.name;
		memberResults = [];
		loanQuery = '';
	}

	$effect(() => {
		getEquipmentOptions().then((opts) => { equipmentOptions = opts; });
	});
</script>

<PageHeader title="Equipment Loans" backHref="/staff/equipment">
	<Action
		action={() => {
			const result = createLoanForMember({
				userId: loanUserId,
				equipmentId: loanEquipmentId || undefined,
				quantity: loanQuantity,
				requestedPickupDate: new Date(loanPickupDate),
				estimatedReturnDate: new Date(loanEstimatedReturnDate),
				memberNotes: loanNotes || undefined
			});
			loanUserId = '';
			loanUserName = '';
			loanEquipmentId = '';
			loanQuantity = 1;
			loanPickupDate = '';
			loanEstimatedReturnDate = '';
			loanNotes = '';
			return result;
		}}
		label="New Loan"
		modalTitle="Create Loan Request"
		successToast="Loan request created"
		class="btn-sm btn-primary"
		canSubmit={!!loanUserId && !!loanPickupDate && !!loanEstimatedReturnDate}
		onsuccess={() => invalidateAll()}
	>
		{#snippet form({ close })}
			<div class="space-y-3">
				{#if loanUserId}
					<div class="flex items-center justify-between bg-base-200 rounded p-2">
						<span class="font-medium">{loanUserName}</span>
						<button type="button" class="btn btn-ghost btn-xs" onclick={() => { loanUserId = ''; loanUserName = ''; }}>Change</button>
					</div>
				{:else}
					<label class="form-control w-full">
						<div class="label"><span class="label-text">Member</span></div>
						<input
							type="text"
							class="input input-bordered w-full"
							bind:value={loanQuery}
							oninput={handleMemberSearch}
							placeholder="Search by name or email..."
						/>
					</label>
					{#if memberResults.length > 0}
						<div class="bg-base-200 rounded max-h-40 overflow-y-auto">
							{#each memberResults as u}
								<button type="button" class="w-full text-left px-3 py-2 hover:bg-base-300 text-sm" onclick={() => selectMember(u)}>
									<span class="font-medium">{u.name}</span>
									<span class="opacity-60 ml-1">{u.email}</span>
								</button>
							{/each}
						</div>
					{/if}
				{/if}
				<label class="form-control w-full">
					<div class="label"><span class="label-text">Equipment</span></div>
					<select class="select select-bordered w-full" bind:value={loanEquipmentId}>
						<option value="">— Select equipment —</option>
						{#each equipmentOptions as eq}
							<option value={eq.id}>{eq.name}</option>
						{/each}
					</select>
				</label>
				<label class="form-control w-full">
					<div class="label"><span class="label-text">Quantity</span></div>
					<input type="number" class="input input-bordered w-full" bind:value={loanQuantity} min="1" max="20" />
				</label>
				<label class="form-control w-full">
					<div class="label"><span class="label-text">Requested pickup date</span></div>
					<input type="date" class="input input-bordered w-full" bind:value={loanPickupDate} />
				</label>
				<label class="form-control w-full">
					<div class="label"><span class="label-text">Estimated return date</span></div>
					<input type="date" class="input input-bordered w-full" bind:value={loanEstimatedReturnDate} />
				</label>
				<label class="form-control w-full">
					<div class="label"><span class="label-text">Notes (optional)</span></div>
					<textarea class="textarea textarea-bordered w-full" bind:value={loanNotes} rows="2"></textarea>
				</label>
			</div>
		{/snippet}
	</Action>
</PageHeader>
<PageContent>

	<DataTable data={data.loans} rowHref={(l) => `/staff/equipment/loans/${l.id}`} clearHref="/staff/equipment/loans" empty="No loans found"
		pagination={{ page: data.pagination.page, totalPages: data.pagination.totalPages }} {buildPageHref}>
		{#snippet toolbar()}
			<Filter.Search name="q" value={data.filters.search} placeholder="Search by member..." />
			<Filter.Select name="status" value={data.filters.status} placeholder="All statuses"
				options={loanStatuses} />
		{/snippet}
		<Column key="userName" header="Member" sortable />
		<Column key="equipmentName" header="Equipment">
			{#snippet cell(_, l)}
				{l.equipmentName ?? '(free-form request)'}
			{/snippet}
		</Column>
		<Column key="status" header="Status" shrink>
			{#snippet cell(_, l)}
				<StatusBadge status={l.status} />
				{#if l.isOverdue}
					<span class="badge badge-error badge-xs ml-1">Overdue</span>
				{/if}
			{/snippet}
		</Column>
		<Column key="requestedPickupDate" header="Requested" sortable type="date" />
		<Column key="dueDate" header="Due" shrink>
			{#snippet cell(_, l)}
				{l.dueDate ? formatDate(l.dueDate) : '—'}
			{/snippet}
		</Column>
		<Column key="totalChargeCents" header="Charge" shrink>
			{#snippet cell(_, l)}
				{l.totalChargeCents != null ? formatCents(l.totalChargeCents) : '—'}
			{/snippet}
		</Column>
	</DataTable>
</PageContent>
