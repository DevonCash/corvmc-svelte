<script lang="ts">
	import { page } from '$app/state';
	import { IconDeviceFloppy } from '@tabler/icons-svelte';
	import {
		getEquipment,
		getEquipmentCategories as getCategories,
		getEquipmentLoanHistory,
		editEquipment,
		deactivateEquipment,
		reactivateEquipment
	} from '$lib/remote/equipment.remote';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { Field } from '$lib/components/shared/Form';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import { ActivateToggleAction } from '$lib/components/shared/actions';
	import MemberLink from '$lib/components/shared/MemberLink.svelte';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import { formatDate, formatCents } from '$lib/utils/format';
	import { equipmentConditions, equipmentStatuses } from '$lib/config';

	const { fields } = editEquipment;

	let id = $derived(page.params.id!);
	let item = $derived(await getEquipment(id));
	let categories = $derived(await getCategories());
	let loanHistory = $derived(await getEquipmentLoanHistory(id));

	let isDeactivated = $derived(!!item.deletedAt);
</script>

	<Form remote={editEquipment} successToast="Equipment updated">
		<input {...fields.id.as('hidden', id)} />
		<PageHeader subtitle="Equipment" title={item.name} backHref="/staff/equipment">
			{#if isDeactivated}
				<Badge variant="error" size="md">Deactivated</Badge>
			{/if}
			<SubmitButton shortcut="mod+s">
				{#snippet icon()}
					<IconDeviceFloppy size={20} />
				{/snippet}
			</SubmitButton>
		</PageHeader>
		<PageContent width="3xl">
		<div class="grid gap-6 lg:grid-cols-2 mb-6">
			<InfoCard title="Equipment Info">
				<div class="grid grid-cols-1 gap-x-2">
					<Field field={fields.name} type="text" value={item.name} />
					<Field field={fields.description} type="textarea" value={item.description ?? ''} />
					<Field field={fields.categoryId} type="select" value={item.categoryId} label="Category">
						{#each categories as cat}
							<option value={cat.id}>{cat.name}</option>
						{/each}
					</Field>
					<div class="grid grid-cols-2 gap-3">
						<Field field={fields.condition} type="select" value={item.condition}>
							{#each equipmentConditions as c}
								<option value={c}>{c}</option>
							{/each}
						</Field>
						<Field field={fields.status} type="select" value={item.status}>
							{#each equipmentStatuses as s}
								<option value={s}>{s}</option>
							{/each}
						</Field>
					</div>
					<Field field={fields.notes} type="textarea" value={item.notes ?? ''} />
				</div>
			</InfoCard>

			<InfoCard title="Inventory" class="bg-base-200 shadow-none">
				<dl class="grid gap-x-4 gap-y-2 text-sm" style="grid-template-columns: auto 1fr;">
					<dt class="opacity-60">ID</dt>
					<dd class="font-mono text-xs">{item.id}</dd>

					<dt class="opacity-60">Category</dt>
					<dd>{item.category.name} <Badge variant="outline" size="xs" class="ml-1">{item.category.pricingTier}</Badge></dd>

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
					<Field field={fields.totalQuantity} type="number" value={item.totalQuantity} label="Total Qty" />
					<Field field={fields.outOfOrderQuantity} type="number" value={item.outOfOrderQuantity} label="Out of Order" />
				</div>
				<div class="grid grid-cols-2 gap-3">
					<Field field={fields.serialNumber} type="text" value={item.serialNumber ?? ''} label="Serial Number" />
					<Field field={fields.resourceId} type="text" value={item.resourceId ?? ''} label="Resource ID" />
				</div>

				<div class="mt-4 flex gap-2">
					<ActivateToggleAction
						entityId={id}
						{isDeactivated}
						deactivateAction={deactivateEquipment}
						reactivateAction={reactivateEquipment}
						entityLabel="Equipment"
					/>
				</div>
			</InfoCard>
		</div>
		</PageContent>
	</Form>

	<PageContent width="3xl">
	<InfoCard title="Loan History">
		<DataTable data={loanHistory} rowHref={(loan) => `/staff/equipment/loans/${loan.id}`} empty="No loan history">
			<Column key="userName" header="Member" stopClick>
				{#snippet cell(_, loan)}
					<MemberLink member={{ name: loan.userName, email: loan.userEmail, pronouns: loan.userPronouns, role: loan.userRole, userId: loan.userId }} />
				{/snippet}
			</Column>
			<Column key="status" header="Status" shrink>
				{#snippet cell(_, loan)}
					<StatusBadge status={loan.status} />
					{#if loan.isOverdue}
						<Badge variant="error" size="xs" class="ml-1">Overdue</Badge>
					{/if}
				{/snippet}
			</Column>
			<Column key="requestedPickupDate" header="Requested" shrink>
				{#snippet cell(_, loan)}
					{formatDate(loan.requestedPickupDate.toISOString())}
				{/snippet}
			</Column>
			<Column key="dueDate" header="Due" shrink>
				{#snippet cell(_, loan)}
					{loan.dueDate ? formatDate(loan.dueDate.toISOString()) : '—'}
				{/snippet}
			</Column>
			<Column key="totalChargeCents" header="Charge" shrink>
				{#snippet cell(_, loan)}
					{loan.totalChargeCents != null ? formatCents(loan.totalChargeCents) : '—'}
				{/snippet}
			</Column>
		</DataTable>
	</InfoCard>
	</PageContent>
