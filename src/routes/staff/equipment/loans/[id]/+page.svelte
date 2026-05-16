<script lang="ts">
	import { page } from '$app/state';
	import {
		getLoan,
		getAvailableEquipment,
		schedule,
		checkout,
		markReturned,
		cancel
	} from './data.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import AsyncButton from '$lib/components/shared/AsyncButton.svelte';
	import MemberLink from '$lib/components/shared/MemberLink.svelte';
	import { formatDate, formatCents } from '$lib/utils/format';

	let id = $derived(page.params.id!);
	let loan = $derived(await getLoan(id));
	let availableEquipment = $derived(await getAvailableEquipment());

	// Schedule form
	let scheduleEquipmentId = $state('');
	let schedulePickupDate = $state('');

	// Checkout form
	let checkoutDueDate = $state('');

	// Return form
	let returnNotes = $state('');

	let chargePreview = $derived.by(() => {
		if (loan.status !== 'checked_out' || !loan.dailyRateCents || !loan.checkedOutAt) return null;
		const now = new Date();
		const ms = now.getTime() - new Date(loan.checkedOutAt).getTime();
		const days = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
		return { days, total: loan.dailyRateCents * days };
	});
</script>

	<PageHeader
		subtitle="Equipment Loan"
		title={loan.equipmentName ?? 'Free-form Request'}
		backHref="/staff/equipment/loans"
	>
		<StatusBadge status={loan.status} />
		{#if loan.isOverdue}
			<span class="badge badge-error">Overdue</span>
		{/if}
	</PageHeader>

	<div class="grid gap-6 lg:grid-cols-2 mb-6">
		<!-- Loan Details -->
		<InfoCard title="Loan Details">
			<dl class="grid gap-x-4 gap-y-2 text-sm" style="grid-template-columns: auto 1fr;">
				<dt class="opacity-60">Loan ID</dt>
				<dd class="font-mono text-xs">{loan.id}</dd>

				<dt class="opacity-60">Member</dt>
				<dd><MemberLink name={loan.userName} email={loan.userEmail} userId={loan.userId} /></dd>

				<dt class="opacity-60">Equipment</dt>
				<dd>
					{#if loan.equipmentName}
						<a href="/staff/equipment/{loan.equipmentId}" class="link">{loan.equipmentName}</a>
						{#if loan.categoryName}
							<span class="badge badge-outline badge-xs ml-1">{loan.categoryName}</span>
						{/if}
					{:else}
						<span class="italic opacity-60">Not yet assigned</span>
					{/if}
				</dd>

				<dt class="opacity-60">Quantity</dt>
				<dd>{loan.quantity}</dd>

				<dt class="opacity-60">Requested pickup</dt>
				<dd>{formatDate(loan.requestedPickupDate.toISOString())}</dd>

				{#if loan.scheduledPickupDate}
					<dt class="opacity-60">Scheduled pickup</dt>
					<dd>{formatDate(loan.scheduledPickupDate.toISOString())}</dd>
				{/if}

				{#if loan.dueDate}
					<dt class="opacity-60">Due date</dt>
					<dd class:text-error={loan.isOverdue}>{formatDate(loan.dueDate.toISOString())}</dd>
				{/if}

				{#if loan.checkedOutAt}
					<dt class="opacity-60">Checked out</dt>
					<dd>{formatDate(loan.checkedOutAt.toISOString())}</dd>
				{/if}

				{#if loan.returnedAt}
					<dt class="opacity-60">Returned</dt>
					<dd>{formatDate(loan.returnedAt.toISOString())}</dd>
				{/if}

				{#if loan.dailyRateCents != null}
					<dt class="opacity-60">Daily rate</dt>
					<dd>{formatCents(loan.dailyRateCents)}/day</dd>
				{/if}

				{#if loan.totalChargeCents != null}
					<dt class="opacity-60">Total charge</dt>
					<dd>{formatCents(loan.totalChargeCents)}</dd>
				{/if}

				{#if loan.creditsCents != null && loan.creditsCents > 0}
					<dt class="opacity-60">Paid via credits</dt>
					<dd>{formatCents(loan.creditsCents)}</dd>
				{/if}

				{#if loan.cashCents != null && loan.cashCents > 0}
					<dt class="opacity-60">Paid via cash/card</dt>
					<dd>{formatCents(loan.cashCents)}</dd>
				{/if}
			</dl>

			{#if loan.memberNotes}
				<div class="mt-4">
					<h4 class="text-sm font-semibold opacity-60 mb-1">Member Notes</h4>
					<p class="text-sm bg-base-200 rounded p-2">{loan.memberNotes}</p>
				</div>
			{/if}

			{#if loan.staffNotes}
				<div class="mt-4">
					<h4 class="text-sm font-semibold opacity-60 mb-1">Staff Notes</h4>
					<p class="text-sm bg-base-200 rounded p-2">{loan.staffNotes}</p>
				</div>
			{/if}
		</InfoCard>

		<!-- Actions Panel -->
		<InfoCard title="Actions">
			{#if loan.status === 'requested'}
				<h4 class="text-sm font-semibold mb-3">Schedule Pickup</h4>
				<form
					onsubmit={async (e) => {
						e.preventDefault();
						await schedule({
							equipmentId: scheduleEquipmentId || (loan.equipmentId ?? ''),
							scheduledPickupDate: new Date(schedulePickupDate)
						});
					}}
					class="space-y-3"
				>
					{#if !loan.equipmentId}
						<div>
							<label class="label label-text" for="schedule-eq">Assign Equipment</label>
							<select id="schedule-eq" class="select select-bordered select-sm w-full" bind:value={scheduleEquipmentId} required>
								<option value="" disabled>Select equipment...</option>
								{#each availableEquipment as eq}
									{#if eq.availableQuantity > 0}
										<option value={eq.id}>{eq.name} ({eq.availableQuantity} available)</option>
									{/if}
								{/each}
							</select>
						</div>
					{/if}
					<div>
						<label class="label label-text" for="schedule-date">Pickup Date</label>
						<input id="schedule-date" type="date" class="input input-bordered input-sm w-full" bind:value={schedulePickupDate} required />
					</div>
					<div class="flex gap-2">
						<button type="submit" class="btn btn-primary btn-sm">Schedule</button>
						<AsyncButton
							action={async () => {
								if (!window.confirm('Cancel this loan request?')) return;
								await cancel({});
							}}
							label="Cancel Request"
							class="btn-ghost btn-sm text-error"
						/>
					</div>
				</form>

			{:else if loan.status === 'scheduled'}
				<h4 class="text-sm font-semibold mb-3">Mark as Checked Out</h4>
				<form
					onsubmit={async (e) => {
						e.preventDefault();
						await checkout({ dueDate: new Date(checkoutDueDate) });
					}}
					class="space-y-3"
				>
					<div>
						<label class="label label-text" for="checkout-due">Due Date</label>
						<input id="checkout-due" type="date" class="input input-bordered input-sm w-full" bind:value={checkoutDueDate} required />
					</div>
					<div class="flex gap-2">
						<button type="submit" class="btn btn-primary btn-sm">Check Out</button>
						<AsyncButton
							action={async () => {
								if (!window.confirm('Cancel this loan?')) return;
								await cancel({});
							}}
							label="Cancel"
							class="btn-ghost btn-sm text-error"
						/>
					</div>
				</form>

			{:else if loan.status === 'checked_out'}
				<h4 class="text-sm font-semibold mb-3">Mark as Returned</h4>

				{#if chargePreview}
					<div class="bg-base-200 rounded p-3 mb-3 text-sm">
						<p><strong>Charge preview:</strong> {chargePreview.days} day{chargePreview.days !== 1 ? 's' : ''} × {formatCents(loan.dailyRateCents ?? 0)}/day = <strong>{formatCents(chargePreview.total)}</strong></p>
					</div>
				{/if}

				<form
					onsubmit={async (e) => {
						e.preventDefault();
						const msg = chargePreview
							? `Mark as returned? This will charge ${formatCents(chargePreview.total)}.`
							: 'Mark as returned?';
						if (!window.confirm(msg)) return;
						await markReturned({ staffNotes: returnNotes || undefined });
					}}
					class="space-y-3"
				>
					<div>
						<label class="label label-text" for="return-notes">Staff Notes (optional)</label>
						<textarea id="return-notes" class="textarea textarea-bordered textarea-sm w-full" bind:value={returnNotes}></textarea>
					</div>
					<button type="submit" class="btn btn-primary btn-sm">Mark Returned</button>
				</form>

			{:else}
				<p class="text-sm opacity-60">
					This loan is <strong>{loan.status}</strong>. No actions available.
				</p>
			{/if}
		</InfoCard>
	</div>


