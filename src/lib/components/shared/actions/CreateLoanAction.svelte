<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { createLoan } from '$lib/remote/equipment.remote';
	import { Field } from '../Form';
	import Button from '$lib/components/shared/Button.svelte';

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
	let equipmentOptions = $state<{ id: string; name: string }[]>([]);
	let memberResults = $state<{ id: string; name: string; email: string }[]>([]);
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
</script>

<Action
	action={createLoan}
	label="New Loan"
	modalTitle="Create Loan Request"
	successToast="Loan request created"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<div class="space-y-3">
			<input type="hidden" name="userId" value={userId} />
			{#if userId}
				<div class="flex items-center justify-between bg-base-200 rounded p-2">
					<span class="font-medium">{userName}</span>
					<Button type="button" class="btn-ghost btn-xs" onclick={() => { userId = ''; userName = ''; }}>Change</Button>
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
			<Field name="equipmentId" type="select" label="Equipment">
				<option value="">-- Select equipment --</option>
				{#each equipmentOptions as eq}
					<option value={eq.id}>{eq.name}</option>
				{/each}
			</Field>
			<Field name="quantity" type="number" label="Quantity" value={1} />
			<Field name="requestedPickupDate" type="date" label="Requested pickup date" />
			<Field name="estimatedReturnDate" type="date" label="Estimated return date" />
			<Field name="memberNotes" type="textarea" label="Notes (optional)" />
		</div>
	{/snippet}
</Action>
