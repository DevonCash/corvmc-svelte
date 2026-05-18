<script lang="ts">
	import { goto } from '$app/navigation';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import * as Filter from '$lib/components/shared/Table/Filter';
	import Modal from '$lib/components/shared/Modal.svelte';
	import { submitRequest } from './data.remote';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import { Field } from '$lib/components/shared/Form';
	import Badge from '$lib/components/shared/Badge.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { IconCircleCheck, IconAlertCircle, IconAlertTriangle } from '@tabler/icons-svelte';
	import type { MemberEquipmentResponse } from '$lib/types/api';

	let { data }: { data: MemberEquipmentResponse } = $props();

	let showRequestModal = $state(false);
	let selectedEquipmentId = $state<string | undefined>(undefined);
	let selectedEquipmentName = $state('');
	let isFreeForm = $state(false);

	function openRequest(equipmentId: string, name: string) {
		selectedEquipmentId = equipmentId;
		selectedEquipmentName = name;
		isFreeForm = false;
		showRequestModal = true;
	}

	function openFreeFormRequest() {
		selectedEquipmentId = undefined;
		selectedEquipmentName = '';
		isFreeForm = true;
		showRequestModal = true;
	}

	function priceLabel(tier: string): string {
		return tier === 'major' ? '$5/day' : '$1/day';
	}
</script>

<PageHeader title="Equipment Catalog">
		<div class="flex items-center gap-3">
			{#if data.creditBalance > 0}
				<Badge variant="info" size="md">{data.creditBalance} credits</Badge>
			{/if}
			<a href="/member/equipment/loans" class="btn btn-sm btn-ghost">My Loans</a>
		</div>
	</PageHeader>
<PageContent>
	<DataTable
		data={data.equipment}
		groupBy={(eq) => eq.categoryName}
		gridClass="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
		clearHref="/member/equipment"
		empty="No equipment available."
	>
		{#snippet toolbar()}
			<Filter.Search name="q" value={data.filters.search} placeholder="Search equipment..." />
			<Filter.Select name="category" value={data.filters.categoryId} placeholder="All categories"
				options={data.categories.map((c) => [c.id, c.name] as [string, string])} />
		{/snippet}
		{#snippet card(eq)}
			<div class="card bg-base-100 border shadow-sm">
				<div class="card-body p-4">
					<h3 class="card-title text-sm">{eq.name}</h3>
					{#if eq.description}
						<p class="text-xs opacity-70 line-clamp-2">{eq.description}</p>
					{/if}
					<div class="flex flex-wrap items-center gap-1 mt-1">
						<span class="tooltip" data-tip={eq.condition}>
							{#if eq.condition === 'good'}
								<IconCircleCheck size={14} class="text-success" />
							{:else if eq.condition === 'fair'}
								<IconAlertCircle size={14} class="text-warning" />
							{:else}
								<IconAlertTriangle size={14} class="text-error" />
							{/if}
						</span>
						<Badge variant="ghost" size="xs">{priceLabel(eq.pricingTier)}</Badge>
						<span class="badge badge-xs" class:badge-error={eq.availableQuantity <= 0}>
							{eq.availableQuantity} available
						</span>
					</div>
					<div class="card-actions mt-2">
						<button
							class="btn btn-primary btn-xs"
							disabled={eq.availableQuantity <= 0}
							onclick={() => openRequest(eq.id, eq.name)}
						>
							Request
						</button>
					</div>
				</div>
			</div>
		{/snippet}
	</DataTable>

	<div class="border-t pt-4">
		<p class="text-sm opacity-70 mb-2">Can't find what you need?</p>
		<button class="btn btn-sm btn-outline" onclick={openFreeFormRequest}>
			Describe Your Request
		</button>
	</div>
</PageContent>

<Modal bind:open={showRequestModal} title={isFreeForm ? 'Free-form Equipment Request' : `Request: ${selectedEquipmentName}`} maxWidth="max-w-md">
	<Form
		remote={submitRequest}
		successToast="Request submitted! Staff will confirm your pickup."
		onsuccess={() => {
			showRequestModal = false;
			goto('/member/equipment/loans');
		}}
	>
		{#if !isFreeForm}
			<input type="hidden" name="equipmentId" value={selectedEquipmentId} />
		{/if}
		<Field name="requestedPickupDate" type="date" label="Preferred Pickup Date" required />
		{#if !isFreeForm}
			<Field name="quantity" type="number" value={1} label="Quantity" />
		{/if}
		<Field name="memberNotes" type="textarea" label={isFreeForm ? 'Describe what you need' : 'Notes (optional)'} required={isFreeForm} />
		<div class="modal-action">
			<button type="button" class="btn btn-ghost" onclick={() => (showRequestModal = false)}>Cancel</button>
			<SubmitButton label="Submit Request" />
		</div>
	</Form>
</Modal>
