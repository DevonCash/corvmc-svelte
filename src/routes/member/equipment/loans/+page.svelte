<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import { cancelMyLoan } from './data.remote';
	import { formatDate, formatCents } from '$lib/utils/format';
	import Action from '$lib/components/shared/Action.svelte';
	import { IconHash, IconCalendar, IconCalendarCheck, IconClock, IconCoin } from '@tabler/icons-svelte';
	import type { MemberEquipmentLoansResponse } from '$lib/types/api';

	let { data }: { data: MemberEquipmentLoansResponse } = $props();

	let activeTab = $state<'active' | 'past'>('active');
</script>

<div class="space-y-6">
	<PageHeader title="My Equipment Loans">
		<a href="/member/equipment" class="btn btn-ghost btn-sm">Browse Catalog</a>
	</PageHeader>

	<!-- Tabs -->
	<div role="tablist" class="tabs-bordered tabs">
		<button
			role="tab"
			class="tab"
			class:tab-active={activeTab === 'active'}
			onclick={() => (activeTab = 'active')}
		>
			Active ({data.active.length})
		</button>
		<button
			role="tab"
			class="tab"
			class:tab-active={activeTab === 'past'}
			onclick={() => (activeTab = 'past')}
		>
			Past ({data.past.length})
		</button>
	</div>

	<!-- Loan Cards -->
	{#if activeTab === 'active'}
		{#each data.active as loan (loan.id)}
			<div class="card border bg-base-100 shadow-sm">
				<div class="card-body p-4">
					<div class="flex items-start justify-between">
						<div>
							<h3 class="font-semibold">
								{loan.equipmentName ?? 'Free-form Request'}
							</h3>
							<div class="mt-1 flex gap-2">
								<StatusBadge status={loan.status} />
								{#if loan.isOverdue}
									<span class="badge badge-sm badge-error">Overdue</span>
								{/if}
							</div>
						</div>
						{#if loan.status === 'requested' || loan.status === 'scheduled'}
							<Action
								confirm="Cancel this loan request?"
								action={() =>
									cancelMyLoan({ loanId: loan.id }).then(() => window.location.reload())}
							/>
							<!-- <AsyncButton
								action={async () => {
									if (!window.confirm('Cancel this loan request?')) return;
									await cancelMyLoan({ loanId: loan.id });
									window.location.reload();
								}}
								label="Cancel"
								class="text-error btn-ghost btn-sm"
							/> -->
						{/if}
					</div>

					<dl class="mt-2 grid gap-x-4 gap-y-1 text-sm" style="grid-template-columns: auto 1fr;">
						{#if loan.quantity > 1}
							<dt class="opacity-60 tooltip flex items-center gap-1" data-tip="Quantity">
								<IconHash size={14} /><span class="hidden sm:inline">Qty</span>
							</dt>
							<dd>{loan.quantity}</dd>
						{/if}
						<dt class="opacity-60 tooltip flex items-center gap-1" data-tip="Requested pickup">
							<IconCalendar size={14} /><span class="hidden sm:inline">Pickup</span>
						</dt>
						<dd>{formatDate(loan.requestedPickupDate)}</dd>
						{#if loan.scheduledPickupDate}
							<dt class="opacity-60 tooltip flex items-center gap-1" data-tip="Confirmed pickup">
								<IconCalendarCheck size={14} /><span class="hidden sm:inline">Confirmed</span>
							</dt>
							<dd>{formatDate(loan.scheduledPickupDate)}</dd>
						{/if}
						{#if loan.dueDate}
							<dt class="opacity-60 tooltip flex items-center gap-1" data-tip="Due date">
								<IconClock size={14} /><span class="hidden sm:inline">Due</span>
							</dt>
							<dd class:text-error={loan.isOverdue}>{formatDate(loan.dueDate)}</dd>
						{/if}
						{#if loan.dailyRateCents != null}
							<dt class="opacity-60 tooltip flex items-center gap-1" data-tip="Daily rate">
								<IconCoin size={14} /><span class="hidden sm:inline">Rate</span>
							</dt>
							<dd>{formatCents(loan.dailyRateCents)}/day</dd>
						{/if}
					</dl>

					{#if loan.memberNotes}
						<p class="mt-2 rounded bg-base-200 p-2 text-xs opacity-60">{loan.memberNotes}</p>
					{/if}
				</div>
			</div>
		{:else}
			<p class="text-center opacity-60 py-8">No active loans.</p>
		{/each}
	{:else}
		{#each data.past as loan (loan.id)}
			<div class="card border bg-base-100 opacity-80 shadow-sm">
				<div class="card-body p-4">
					<div class="flex items-start justify-between">
						<h3 class="font-semibold">{loan.equipmentName ?? 'Free-form Request'}</h3>
						<StatusBadge status={loan.status} />
					</div>

					<dl class="mt-2 grid gap-x-4 gap-y-1 text-sm" style="grid-template-columns: auto 1fr;">
						{#if loan.returnedAt}
							<dt class="opacity-60">Returned</dt>
							<dd>{formatDate(loan.returnedAt)}</dd>
						{/if}
						{#if loan.totalChargeCents != null}
							<dt class="opacity-60">Charged</dt>
							<dd>
								{formatCents(loan.totalChargeCents)}
								{#if loan.creditsCents && loan.creditsCents > 0}
									<span class="text-xs opacity-60">({formatCents(loan.creditsCents)} credits)</span>
								{/if}
							</dd>
						{/if}
					</dl>
				</div>
			</div>
		{:else}
			<p class="text-center opacity-60 py-8">No past loans.</p>
		{/each}
	{/if}
</div>
