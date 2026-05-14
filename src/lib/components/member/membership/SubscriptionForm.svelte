<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { DOLLARS_PER_UNIT } from '$lib/finance/types';

	const MIN_AMOUNT = DOLLARS_PER_UNIT * 2; // $10 minimum

	let {
		mode,
		currentAmount,
		currentCoverFees = false,
		formAction
	}: {
		mode: 'create' | 'modify';
		currentAmount?: number;
		currentCoverFees?: boolean;
		formAction: string;
	} = $props();

	let amount = $state(untrack(() => currentAmount ?? MIN_AMOUNT));
	let coverFees = $state(untrack(() => currentCoverFees));
	let submitting = $state(false);

	// Fee calculation: solve for total where total - (total * 0.029 + 0.30) = base
	// This mirrors the server-side calculateTotalWithFeeCoverage() in fees.ts.
	// If Stripe's rate changes, update both places.
	function calcFeeCents(baseCents: number): number {
		if (baseCents <= 0) return 0;
		const totalCents = Math.ceil((baseCents + 30) / (1 - 0.029));
		return totalCents - baseCents;
	}

	const freeHours = $derived(Math.floor(amount / DOLLARS_PER_UNIT));
	const feeCents = $derived(coverFees ? calcFeeCents(amount * 100) : 0);
	const feeDisplay = $derived((feeCents / 100).toFixed(2));
	const totalDisplay = $derived(coverFees ? ((amount * 100 + feeCents) / 100).toFixed(2) : amount.toFixed(2));
</script>

<form
	method="POST"
	action={formAction}
	use:enhance={() => {
		submitting = true;
		return async ({ update }) => {
			submitting = false;
			await update();
		};
	}}
	class="card bg-base-100 shadow-sm"
>
	<div class="card-body">
		<h3 class="card-title">
			{mode === 'create' ? 'Start Contributing' : 'Update Your Contribution'}
		</h3>

		<div class="form-control mt-4">
			<label class="label" for="amount">
				<span class="label-text">Monthly amount</span>
			</label>
			<div class="join">
				<span class="join-item btn btn-disabled">$</span>
				<input
					id="amount"
					name="amount"
					type="number"
					min={MIN_AMOUNT}
					step={DOLLARS_PER_UNIT}
					bind:value={amount}
					class="input join-item input-bordered w-full"
					required
				/>
				<span class="join-item btn btn-disabled">/month</span>
			</div>
			<label class="label" for="amount">
				<span class="label-text-alt text-primary font-medium">
					= {freeHours} free practice hour{freeHours === 1 ? '' : 's'}
				</span>
			</label>
		</div>

		<div class="form-control mt-2">
			<label class="label cursor-pointer justify-start gap-3">
				<input
					type="checkbox"
					name="coverFees"
					bind:checked={coverFees}
					class="checkbox checkbox-sm"
				/>
				<span class="label-text">
					Cover processing fees so the Collective receives 100% of your contribution
				</span>
			</label>
			{#if coverFees}
				<p class="ml-9 text-sm opacity-60">
					+${feeDisplay} fee coverage — you'll be charged ${totalDisplay}/month total
				</p>
			{/if}
		</div>

		<div class="card-actions mt-6">
			<button
				type="submit"
				class="btn btn-primary"
				disabled={submitting || amount < MIN_AMOUNT}
			>
				{#if submitting}
					<span class="loading loading-spinner loading-sm"></span>
				{/if}
				{mode === 'create' ? 'Become a Sustaining Member' : 'Update Amount'}
			</button>
		</div>
	</div>
</form>
