<script lang="ts">
	import { page } from '$app/state';
	import { IconDeviceFloppy } from '@tabler/icons-svelte';
	import {
		getEquipment,
		getCategories,
		getEquipmentLoanHistory,
		editEquipment,
		deactivateEquipment,
		reactivateEquipment
	} from './data.remote';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { Field } from '$lib/components/shared/Form';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import MemberLink from '$lib/components/shared/MemberLink.svelte';
	import { formatDate, formatCents } from '$lib/utils/format';
	import { equipmentConditions, equipmentStatuses } from '$lib/types/equipment';

	let id = $derived(page.params.id!);
	let item = $derived(await getEquipment(id));
	let categories = $derived(await getCategories());
	let loanHistory = $derived(await getEquipmentLoanHistory(id));

	let isDeactivated = $derived(!!item.deletedAt);
</script>

	<Form remote={editEquipment} successToast="Equipment updated">
		<PageHeader subtitle="Equipment" title={item.name} backHref="/staff/equipment">
			{#if isDeactivated}
				<span class="badge badge-error">Deactivated</span>
			{/if}
			<SubmitButton shortcut="mod+s">
				{#snippet icon()}
					<IconDeviceFloppy size={20} />
				{/snippet}
			</SubmitButton>
		</PageHeader>

		<div class="grid gap-6 lg:grid-cols-2 mb-6">
			<InfoCard title="Equipment Info">
				<div class="grid grid-cols-1 gap-x-2">
					<Field name="name" type="text" value={item.name} />
					<Field name="description" type="textarea" value={item.description ?? ''} />
					<Field name="categoryId" type="select" value={item.categoryId} label="Category">
						{#each categories as cat}
							<option value={cat.id}>{cat.name}</option>
						{/each}
					</Field>
					<div class="grid grid-cols-2 gap-3">
						<Field name="condition" type="select" value={item.condition}>
							{#each equipmentConditions as c}
								<option value={c}>{c}</option>
							{/each}
						</Field>
						<Field name="status" type="select" value={item.status}>
							{#each equipmentStatuses as s}
								<option value={s}>{s}</option>
							{/each}
						</Field>
					</div>
					<Field name="notes" type="textarea" value={item.notes ?? ''} />
				</div>
			</InfoCard>

			<InfoCard title="Inventory" class="bg-base-200 shadow-none">
				<dl class="grid gap-x-4 gap-y-2 text-sm" style="grid-template-columns: auto 1fr;">
					<dt class="opacity-60">ID</dt>
					<dd class="font-mono text-xs">{item.id}</dd>

					<dt class="opacity-60">Category</dt>
					<dd>{item.category.name} <span class="badge badge-outline badge-xs ml-1">{item.category.pricingTier}</span></dd>

					<dt class="opacity-60">Available</dt>
					<dd class:text-error={item.availableQuantity <= 0}>
						{item.availableQuantity} of {item.totalQuantity}
						{#if item.outOfOrderQuantity > 0}
							<span class="text-warning text-xs">({item.outOfOrderQuantity} out of order)</span>
						{/if}
						{#if item.loanedQuantity > 0}
							<span class="text-info text-xs">({item.loanedQuantity} on loan)</span>
						{/if}
					</dd>
				</dl>

				<div class="grid grid-cols-2 gap-3 mt-4">
					<Field name="totalQuantity" type="number" value={item.totalQuantity} label="Total Qty" />
					<Field name="outOfOrderQuantity" type="number" value={item.outOfOrderQuantity} label="Out of Order" />
				</div>
				<div class="grid grid-cols-2 gap-3">
					<Field name="serialNumber" type="text" value={item.serialNumber ?? ''} label="Serial Number" />
					<Field name="resourceId" type="text" value={item.resourceId ?? ''} label="Resource ID" />
				</div>

				<div class="mt-4 flex gap-2">
					{#if isDeactivated}
						<Action
							action={() => reactivateEquipment({})}
							label="Reactivate"
							successToast="Equipment reactivated"
							class="btn-success btn-sm"
						/>
					{:else}
						<Action
							action={async () => {
								if (!window.confirm('Deactivate this equipment?')) return;
								await deactivateEquipment({});
							}}
							label="Deactivate"
							successToast="Equipment deactivated"
							class="btn-error btn-sm"
						/>
					{/if}
				</div>
			</InfoCard>
		</div>
	</Form>

	<!-- Loan History -->
	<InfoCard title="Loan History">
		<div class="overflow-x-auto">
			<table class="table table-sm">
				<thead>
					<tr>
						<th>Member</th>
						<th>Status</th>
						<th>Requested</th>
						<th>Due</th>
						<th>Charge</th>
					</tr>
				</thead>
				<tbody>
					{#each loanHistory as loan (loan.id)}
						<tr
							class="hover cursor-pointer"
							onclick={() => window.location.href = `/staff/equipment/loans/${loan.id}`}
						>
							<td>
								<MemberLink name={loan.userName} email={loan.userEmail} userId={loan.userId} />
							</td>
							<td>
								<StatusBadge status={loan.status} />
								{#if loan.isOverdue}
									<span class="badge badge-error badge-xs ml-1">Overdue</span>
								{/if}
							</td>
							<td class="text-sm">{formatDate(loan.requestedPickupDate.toISOString())}</td>
							<td class="text-sm">{loan.dueDate ? formatDate(loan.dueDate.toISOString()) : '—'}</td>
							<td class="text-sm">{loan.totalChargeCents != null ? formatCents(loan.totalChargeCents) : '—'}</td>
						</tr>
					{:else}
						<tr>
							<td colspan="5" class="text-center opacity-60 py-4">No loan history</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</InfoCard>


