<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { adjustCredits } from '$lib/remote/users.remote';

	let {
		userId,
		class: className = 'btn-outline btn-sm',
		onsuccess,
		...rest
	}: {
		userId: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();

	let creditType = $state<'free_hours' | 'equipment_credits'>('free_hours');
	let amount = $state(0);
	let description = $state('');
</script>

<Action
	action={adjustCredits}
	label="Adjust"
	modalTitle="Adjust Credits"
	successToast="Credits adjusted"
	class={className}
	canSubmit={amount !== 0 && description.trim().length > 0}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input type="hidden" name="userId" value={userId} />
		<div class="space-y-3">
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Credit Type</span></div>
				<select class="select select-bordered w-full" name="creditType" bind:value={creditType}>
					<option value="free_hours">Free Hours</option>
					<option value="equipment_credits">Equipment Credits</option>
				</select>
			</label>
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Amount</span></div>
				<input
					type="number"
					class="input input-bordered w-full"
					name="amount"
					bind:value={amount}
					placeholder="Positive to add, negative to deduct"
				/>
			</label>
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Reason</span></div>
				<input
					type="text"
					class="input input-bordered w-full"
					name="description"
					bind:value={description}
					placeholder="Why is this adjustment being made?"
				/>
			</label>
		</div>
	{/snippet}
</Action>
