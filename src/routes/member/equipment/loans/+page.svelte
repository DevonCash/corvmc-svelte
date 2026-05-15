<script lang="ts">
	import type { PageServerData } from './$types';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import AsyncButton from '$lib/components/shared/AsyncButton.svelte';
	import { cancelMyLoan } from './data.remote';
	import { formatDate, formatCents } from '$lib/utils/format';

	let { data }: { data: PageServerData } = $props();

	let activeTab = $state<'active' | 'past'>('active');
</script>

<div class="space-y-6">
	<PageHeader title="My Equipment Loans">
		<a href="/member/equipment" class="btn btn-sm btn-ghost">Browse Catalog</a>
	</PageHeader>

	<!-- Tabs -->
	<div role="tablist" class="tabs tabs-bordered">
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
			<div class="card bg-base-100 border shadow-sm">
				<div class="card-body p-4">
					<div class="flex items-start justify-between">
						<div>
							<h3 class="font-semibold">
								{loan.equipmentName ?? 'Free-form Request'}
							</h3>
							<div class="flex gap-2 mt-1">
								<StatusBadge status={loan.status} />
								{#if loan.isOverdue}
									<span class="badge badge-error badge-sm">Overdue</span>
								{/if}
							</div>
						</div>
						{#if loan.status === 'requested' || loan.status === 'scheduled'}
							<AsyncButton
								action={async () => {
									if (!window.confirm('Cancel this loan request?')) return;
									await cancelMyLoan({ loanId: loan.id });
									window.location.reload();
								}}
								label="Cancel"
								class="btn-ghost btn-sm text-error"
							/>
						{/if}
					</div>

					<dl class="grid gap-x-4 gap-y-1 text-sm mt-2" style="grid-template-columns: auto 1fr;">
						{#if loan.quantity > 1}
							<dt class="opacity-60">Quantity</dt>
							<dd>{loan.quantity}</dd>
						{/if}
						<dt class="opacity-60">Requested pickup</dt>
						<dd>{formatDate(loan.requestedPickupDate)}</dd>
						{#if loan.scheduledPickupDate}
							<dt class="opacity-60">Confirmed pickup</dt>
							<dd>{formatDate(loan.scheduledPickupDate)}</dd>
						{/if}
						{#if loan.dueDate}
							<dt class="opacity-60">Due</dt>
							<dd class:text-error={loan.isOverdue}>{formatDate(loan.dueDate)}</dd>
						{/if}
						{#if loan.dailyRateCents != null}
							<dt class="opacity-60">Rate</dt>
							<dd>{formatCents(loan.dailyRateCents)}/day</dd>
						{/if}
					</dl>

					{#if loan.memberNotes}
						<p class="text-xs opacity-60 mt-2 bg-base-200 rounded p-2">{loan.memberNotes}</p>
					{/if}
				</div>
			</div>
		{:else}
			<p class="text-center opacity-60 py-8">No active loans.</p>
		{/each}
	{:else}
		{#each data.past as loan (loan.id)}
			<div class="card bg-base-100 border shadow-sm opacity-80">
				<div class="card-body p-4">
					<div class="flex items-start justify-between">
						<h3 class="font-semibold">{loan.equipmentName ?? 'Free-form Request'}</h3>
						<StatusBadge status={loan.status} />
					</div>

					<dl class="grid gap-x-4 gap-y-1 text-sm mt-2" style="grid-template-columns: auto 1fr;">
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
