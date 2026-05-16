<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import { submitRequest } from './data.remote';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import { Field } from '$lib/components/shared/Form';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { formatCents } from '$lib/utils/format';
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

	// Group equipment by category
	let groupedEquipment = $derived.by(() => {
		const groups: Map<string, typeof data.equipment> = new Map();
		for (const eq of data.equipment) {
			const key = eq.categoryName;
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(eq);
		}
		return [...groups.entries()];
	});
</script>

<div class="space-y-6">
	<PageHeader title="Equipment Catalog">
		<div class="flex items-center gap-3">
			{#if data.creditBalance > 0}
				<span class="badge badge-info">{data.creditBalance} credits</span>
			{/if}
			<a href="/member/equipment/loans" class="btn btn-sm btn-ghost">My Loans</a>
		</div>
	</PageHeader>

	<!-- Filters -->
	<form method="get" class="flex flex-wrap items-end gap-2">
		<input
			type="text"
			name="q"
			value={data.filters.search}
			placeholder="Search equipment..."
			class="input-bordered input input-sm w-48"
		/>
		<select name="category" class="select-bordered select select-sm">
			<option value="">All categories</option>
			{#each data.categories as cat}
				<option value={cat.id} selected={data.filters.categoryId === cat.id}>{cat.name}</option>
			{/each}
		</select>
		<button type="submit" class="btn btn-sm btn-primary">Filter</button>
		{#if data.filters.search || data.filters.categoryId}
			<a href="/member/equipment" class="btn btn-ghost btn-sm">Clear</a>
		{/if}
	</form>

	<!-- Equipment Grid by Category -->
	{#each groupedEquipment as [categoryName, items]}
		<div>
			<h2 class="text-lg font-semibold mb-3">{categoryName}</h2>
			<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{#each items as eq (eq.id)}
					<div class="card bg-base-100 border shadow-sm">
						<div class="card-body p-4">
							<h3 class="card-title text-sm">{eq.name}</h3>
							{#if eq.description}
								<p class="text-xs opacity-70 line-clamp-2">{eq.description}</p>
							{/if}
							<div class="flex flex-wrap gap-1 mt-1">
								<span class="badge badge-outline badge-xs">{eq.condition}</span>
								<span class="badge badge-ghost badge-xs">{priceLabel(eq.pricingTier)}</span>
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
				{/each}
			</div>
		</div>
	{:else}
		<p class="text-center opacity-60 py-8">No equipment available.</p>
	{/each}

	<!-- Free-form request -->
	<div class="border-t pt-4">
		<p class="text-sm opacity-70 mb-2">Can't find what you need?</p>
		<button class="btn btn-sm btn-outline" onclick={openFreeFormRequest}>
			Describe Your Request
		</button>
	</div>
</div>

<!-- Request Modal -->
{#if showRequestModal}
	<dialog class="modal modal-open">
		<div class="modal-box max-w-md">
			<h3 class="font-bold text-lg mb-4">
				{isFreeForm ? 'Free-form Equipment Request' : `Request: ${selectedEquipmentName}`}
			</h3>
			<Form
				remote={submitRequest}
				successToast="Request submitted! Staff will confirm your pickup."
				onSuccess={() => {
					showRequestModal = false;
					window.location.href = '/member/equipment/loans';
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
		</div>
		<form method="dialog" class="modal-backdrop">
			<button onclick={() => (showRequestModal = false)}>close</button>
		</form>
	</dialog>
{/if}
