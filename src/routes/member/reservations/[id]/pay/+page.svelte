<script lang="ts">
	import { DOLLARS_PER_UNIT } from '$lib/config';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import { payReservation } from '$lib/remote/reservations.remote';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const res = $derived(data.reservation);
	const totalCents = $derived(data.totalCents);
	const freeHoursBalance = $derived(data.freeHoursBalance);
	const durationHours = $derived(data.durationHours);

	let coverFees = $state(false);

	const creditsApplicable = $derived(Math.min(freeHoursBalance, durationHours));
	const creditDiscountCents = $derived(creditsApplicable * (totalCents / durationHours));
	const remainingCents = $derived(totalCents - creditDiscountCents);

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			timeZone: 'America/Los_Angeles',
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		});
	}

	function formatTime(iso: string): string {
		return new Date(iso).toLocaleTimeString('en-US', {
			timeZone: 'America/Los_Angeles',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function cents(amount: number): string {
		return (amount / 100).toFixed(2);
	}

	function calcFeeCents(baseCents: number): number {
		if (baseCents <= 0) return 0;
		return Math.ceil((baseCents + 30) / (1 - 0.029)) - baseCents;
	}

	const feeCents = $derived(coverFees ? calcFeeCents(remainingCents) : 0);
	const chargeTotal = $derived(remainingCents + feeCents);
</script>

<PageHeader title="Pay for Your Session" />
<PageContent width="md">

	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<p class="font-medium">{formatDate(res.startsAt)}</p>
			<p>{formatTime(res.startsAt)}–{formatTime(res.endsAt)} ({durationHours} hour{durationHours === 1 ? '' : 's'})</p>
			{#if res.notes}
				<p class="text-sm opacity-60">{res.notes}</p>
			{/if}
		</div>
	</div>

	<div class="card bg-base-100 shadow-sm">
		<div class="card-body space-y-2">
			<div class="flex justify-between">
				<span>Room rental ({durationHours}hr × ${cents(totalCents / durationHours)}/hr)</span>
				<span>${cents(totalCents)}</span>
			</div>

			{#if creditsApplicable > 0}
				<div class="flex justify-between text-success">
					<span>Free hours ({creditsApplicable} of {freeHoursBalance} available)</span>
					<span>−${cents(creditDiscountCents)}</span>
				</div>
			{/if}

			{#if remainingCents > 0 && coverFees}
				<div class="flex justify-between text-sm opacity-60">
					<span>Processing fee coverage</span>
					<span>+${cents(feeCents)}</span>
				</div>
			{/if}

			<div class="divider my-1"></div>

			<div class="flex justify-between font-bold">
				<span>Total</span>
				<span>
					{#if remainingCents <= 0}
						$0.00 (covered by free hours)
					{:else}
						${cents(chargeTotal)}
					{/if}
				</span>
			</div>
		</div>
	</div>

	<Form remote={payReservation}>
		{#if remainingCents > 0}
			<div class="form-control">
				<label class="label cursor-pointer justify-start gap-3">
					<input
						type="checkbox"
						name="coverFees"
						bind:checked={coverFees}
						class="checkbox checkbox-sm"
					/>
					<span class="label-text">
						Cover processing fees so the Collective receives 100%
					</span>
				</label>
			</div>
		{/if}

		<SubmitButton class="btn-primary w-full mt-4">
			{#if remainingCents <= 0}
				Confirm (Free Hours)
			{:else}
				Pay ${cents(chargeTotal)}
			{/if}
		</SubmitButton>
	</Form>

	<Button href="/member/reservations" class="btn-ghost w-full">Back to Reservations</Button>
</PageContent>
