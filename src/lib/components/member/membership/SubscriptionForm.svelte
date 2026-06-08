<script lang="ts">
	import { untrack } from 'svelte';
	import { DOLLARS_PER_UNIT } from '$lib/config';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import type { RemoteForm } from '$lib/components/shared/Form/Form.svelte';

	const STEP = DOLLARS_PER_UNIT;
	const MIN_AMOUNT = DOLLARS_PER_UNIT * 2; // $10 → 2 free hours
	const MAX_AMOUNT = DOLLARS_PER_UNIT * 12; // $60 → 12 free hours

	let {
		mode,
		currentAmount,
		currentCoverFees = false,
		remote,
		onsuccess
	}: {
		mode: 'create' | 'modify';
		currentAmount?: number;
		currentCoverFees?: boolean;
		remote: RemoteForm<any, any>;
		onsuccess?: () => void;
	} = $props();

	let amount = $state(untrack(() => currentAmount ?? MIN_AMOUNT));
	let coverFees = $state(untrack(() => currentCoverFees));

	// Solve for the total that, after Stripe takes 2.9% + 30¢, nets the base amount.
	function calcFeeCents(baseCents: number): number {
		if (baseCents <= 0) return 0;
		const totalCents = Math.ceil((baseCents + 30) / (1 - 0.029));
		return totalCents - baseCents;
	}

	const freeHours = $derived(Math.floor(amount / DOLLARS_PER_UNIT));
	const feeCents = $derived(coverFees ? calcFeeCents(amount * 100) : 0);
	const feeDisplay = $derived((feeCents / 100).toFixed(2));
	const totalDisplay = $derived(((amount * 100 + feeCents) / 100).toFixed(2));

	// Tick labels under the slider: $10, $20 … $60.
	const ticks = Array.from(
		{ length: (MAX_AMOUNT - MIN_AMOUNT) / STEP + 1 },
		(_, i) => MIN_AMOUNT + i * STEP
	);
	const labelledTicks = ticks.filter((v) => v % 10 === 0);
</script>

<Form {remote} {onsuccess} class="space-y-6">
	<div>
		<div class="flex items-baseline justify-between">
			<span class="label-text font-medium">Monthly contribution</span>
			<span class="text-3xl font-bold text-primary">${amount}</span>
		</div>

		<input
			id="amount"
			name="amount"
			type="range"
			min={MIN_AMOUNT}
			max={MAX_AMOUNT}
			step={STEP}
			bind:value={amount}
			class="range range-primary mt-3"
			aria-label="Monthly contribution amount"
		/>
		<div class="mt-1 flex w-full justify-between px-1 text-xs opacity-50">
			{#each ticks as tick (tick)}
				<span class="flex flex-col items-center">
					<span aria-hidden="true">|</span>
					{#if labelledTicks.includes(tick)}
						<span class="mt-0.5">${tick}</span>
					{/if}
				</span>
			{/each}
		</div>

		<p class="mt-4 text-sm font-medium text-primary">
			= {freeHours} free practice hour{freeHours === 1 ? '' : 's'} every month
		</p>
	</div>

	<div>
		<label class="label cursor-pointer justify-start gap-3">
			<input
				type="checkbox"
				name="coverFees"
				bind:checked={coverFees}
				class="toggle toggle-primary toggle-sm"
			/>
			<span class="label-text">
				Cover processing fees so the Collective receives 100% of your contribution
			</span>
		</label>
		{#if coverFees}
			<p class="ml-12 text-sm opacity-60">
				Adds ${feeDisplay} to cover processing fees (2.9% + $0.30)
			</p>
		{/if}
	</div>

	<div class="rounded-lg bg-base-200/50 p-4">
		<p class="text-sm opacity-60">New monthly total</p>
		<p class="mt-1 font-semibold text-primary">
			${amount}.00 membership{#if coverFees}
				+ ${feeDisplay} processing fees{/if} = ${totalDisplay} total per month
		</p>
	</div>

	<SubmitButton
		class="btn-primary w-full"
		label={mode === 'create' ? 'Become a Sustaining Member' : 'Update Contribution'}
	/>
</Form>
