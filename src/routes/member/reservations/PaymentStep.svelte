<script lang="ts">
	import { base } from '$app/paths';
	import { getReservationPricing } from '$lib/remote/reservations.remote';
	import { getFormContext } from '$lib/components/shared/Form/Form.svelte';
	import * as Form from '$lib/components/shared/Form';

	let {
		reservation,
		precedingSteps = reservation ? 1 : 2
	}: {
		reservation?: { id: string; startsAt: string; endsAt: string };
		precedingSteps?: number;
	} = $props();

	const formCtx = getFormContext()!;

	const activeStep = $derived(precedingSteps);

	let el: HTMLDivElement;
	let coverFees = $state(false);

	let pricing = $state<{
		durationHours: number;
		hourlyRateCents: number;
		totalCents: number;
		freeHoursBalance: number;
		creditsApplicable: number;
		creditDiscountCents: number;
		remainingCents: number;
		isSustainingMember: boolean;
	} | null>(null);

	function extractTimeFields(iso: string) {
		const d = new Date(iso);
		// Format in Pacific time to match the create flow
		const date = d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
		const time = d.toLocaleTimeString('en-GB', {
			timeZone: 'America/Los_Angeles',
			hour: '2-digit',
			minute: '2-digit'
		});
		return { date, time };
	}

	$effect(() => {
		if (formCtx.currentStep === activeStep && el) {
			let date: string | null = null;
			let startTime: string | null = null;
			let endTime: string | null = null;

			if (reservation) {
				const start = extractTimeFields(reservation.startsAt);
				const end = extractTimeFields(reservation.endsAt);
				date = start.date;
				startTime = start.time;
				endTime = end.time;
			} else {
				const form = el.closest('form');
				if (form) {
					const fd = new FormData(form);
					date = fd.get('date') as string;
					startTime = fd.get('startTime') as string;
					endTime = fd.get('endTime') as string;
				}
			}

			if (date && startTime && endTime) {
				pricing = null;
				getReservationPricing({ date, startTime, endTime }).then((result) => {
					pricing = result;
				});
			}
		}
	});

	function calcFeeCents(baseCents: number): number {
		if (baseCents <= 0) return 0;
		return Math.ceil((baseCents + 30) / (1 - 0.029)) - baseCents;
	}

	function cents(amount: number): string {
		return (amount / 100).toFixed(2);
	}

	let feeCents = $derived(pricing && coverFees ? calcFeeCents(pricing.remainingCents) : 0);
	let chargeTotal = $derived(pricing ? pricing.remainingCents + feeCents : 0);
	let payLabel = $derived(
		pricing
			? pricing.remainingCents <= 0
				? 'Confirm (Free Hours)'
				: `Pay $${cents(chargeTotal)}`
			: 'Loading...'
	);
</script>

<div bind:this={el}>
	<Form.Step>
		{#if reservation}
			<input type="hidden" name="id" value={reservation.id} />
		{/if}

		{#if !pricing}
			<div class="space-y-2 py-2">
				<div class="flex justify-between">
					<div class="skeleton h-5 w-48"></div>
					<div class="skeleton h-5 w-16"></div>
				</div>
				<div class="divider my-1"></div>
				<div class="flex justify-between">
					<div class="skeleton h-6 w-16"></div>
					<div class="skeleton h-6 w-20"></div>
				</div>
			</div>
		{:else}
			<div class="space-y-2">
				<div class="flex justify-between">
					<span
						>Room rental ({pricing.durationHours}hr × ${cents(pricing.hourlyRateCents)}/hr)</span
					>
					<span>${cents(pricing.totalCents)}</span>
				</div>

				{#if pricing.creditsApplicable > 0}
					<div class="flex justify-between text-success">
						<span
							>Free hours ({pricing.creditsApplicable} of {pricing.freeHoursBalance} available)</span
						>
						<span>-${cents(pricing.creditDiscountCents)}</span>
					</div>
				{/if}

				{#if pricing.remainingCents > 0 && coverFees}
					<div class="flex justify-between text-sm opacity-60">
						<span>Processing fee coverage</span>
						<span>+${cents(feeCents)}</span>
					</div>
				{/if}

				<div class="divider my-1"></div>

				<div class="flex justify-between font-bold">
					<span>Total</span>
					<span>
						{#if pricing.remainingCents <= 0}
							$0.00 (covered by free hours)
						{:else}
							${cents(chargeTotal)}
						{/if}
					</span>
				</div>
			</div>

			{#if pricing.remainingCents > 0}
				<Form.Field
					name="coverFees"
					label=""
					type="checkbox"
					bind:value={coverFees}
					checkboxLabel="Cover ${cents(calcFeeCents(pricing.remainingCents))} processing fee so the Collective receives 100%"
				/>
			{/if}

			{#if !pricing.isSustainingMember}
				<div class="mt-2 rounded-box border border-base-300 bg-base-200 px-4 py-3 text-sm">
					Sustaining members get free rehearsal hours every month.
					<a href="{base}/member/membership" target="_blank" class="link link-primary">Learn more</a
					>
				</div>
			{/if}
		{/if}

		<div class="flex justify-end pt-2">
			<Form.SubmitButton label={payLabel} class="btn-primary" />
		</div>
	</Form.Step>
</div>
