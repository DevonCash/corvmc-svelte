<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';

	let {
		class: className = 'btn-sm btn-primary',
		onsuccess,
		...rest
	}: {
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();

	let query = $state('');
	let userId = $state('');
	let userName = $state('');
	let equipmentId = $state('');
	let quantity = $state(1);
	let pickupDate = $state('');
	let estimatedReturnDate = $state('');
	let notes = $state('');
	let memberResults = $state<{ id: string; name: string; email: string }[]>([]);
	let equipmentOptions = $state<{ id: string; name: string }[]>([]);
	let searching = $state(false);

	async function handleMemberSearch() {
		if (query.length < 2) { memberResults = []; return; }
		searching = true;
		try {
			const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
			memberResults = await res.json();
		} finally {
			searching = false;
		}
	}

	function selectMember(u: { id: string; name: string }) {
		userId = u.id;
		userName = u.name;
		memberResults = [];
		query = '';
	}

	async function loadEquipmentOptions() {
		const res = await fetch('/api/equipment?available=true');
		if (res.ok) {
			const data = (await res.json()) as { rows?: { id: string; name: string }[] };
			equipmentOptions = (data.rows ?? []).map((e) => ({ id: e.id, name: e.name }));
		}
	}

	$effect(() => { loadEquipmentOptions(); });

	function execute() {
		const result = actionFetch('/api/equipment/loans', {
			body: {
				userId,
				equipmentId: equipmentId || undefined,
				quantity,
				requestedPickupDate: pickupDate,
				estimatedReturnDate,
				memberNotes: notes || undefined
			}
		});
		userId = ''; userName = ''; equipmentId = ''; quantity = 1;
		pickupDate = ''; estimatedReturnDate = ''; notes = '';
		return result;
	}
</script>

<Action
	action={execute}
	label="New Loan"
	modalTitle="Create Loan Request"
	successToast="Loan request created"
	canSubmit={!!userId && !!pickupDate && !!estimatedReturnDate}
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<div class="space-y-3">
			{#if userId}
				<div class="flex items-center justify-between bg-base-200 rounded p-2">
					<span class="font-medium">{userName}</span>
					<button type="button" class="btn btn-ghost btn-xs" onclick={() => { userId = ''; userName = ''; }}>Change</button>
				</div>
			{:else}
				<label class="form-control w-full">
					<div class="label"><span class="label-text">Member</span></div>
					<input
						type="text"
						class="input input-bordered w-full"
						bind:value={query}
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
				<select class="select select-bordered w-full" bind:value={equipmentId}>
					<option value="">— Select equipment —</option>
					{#each equipmentOptions as eq}
						<option value={eq.id}>{eq.name}</option>
					{/each}
				</select>
			</label>
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Quantity</span></div>
				<input type="number" class="input input-bordered w-full" bind:value={quantity} min="1" max="20" />
			</label>
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Requested pickup date</span></div>
				<input type="date" class="input input-bordered w-full" bind:value={pickupDate} />
			</label>
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Estimated return date</span></div>
				<input type="date" class="input input-bordered w-full" bind:value={estimatedReturnDate} />
			</label>
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Notes (optional)</span></div>
				<textarea class="textarea textarea-bordered w-full" bind:value={notes} rows="2"></textarea>
			</label>
		</div>
	{/snippet}
</Action>
