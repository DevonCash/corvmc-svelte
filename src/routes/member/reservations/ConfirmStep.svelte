<script lang="ts">
	import { getReservationPricing } from '$lib/remote/reservations.remote';
	import { getFormContext } from '$lib/components/shared/Form/Form.svelte';
	import * as Form from '$lib/components/shared/Form';
	import { fullDate, formatTimeRange } from '$lib/utils/format';

	let {
		reservation
	}: {
		reservation?: { id: string; startsAt: string; endsAt: string };
	} = $props();

	const formCtx = getFormContext()!;

	const activeStep = $derived(reservation ? 0 : 1);

	let el: HTMLDivElement;
	let skipPaymentInput: HTMLInputElement;

	function extractTimeFields(iso: string) {
		const d = new Date(iso);
		const date = d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
		const time = d.toLocaleTimeString('en-GB', {
			timeZone: 'America/Los_Angeles',
			hour: '2-digit',
			minute: '2-digit'
		});
		return { date, time };
	}

	let pricing = $state<{
		durationHours: number;
		hourlyRateCents: number;
		totalCents: number;
		remainingCents: number;
	} | null>(null);

	let dateLabel = $state('');
	let timeLabel = $state('');

	function cents(amount: number): string {
		return (amount / 100).toFixed(2);
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
				dateLabel = fullDate(reservation.startsAt);
				timeLabel = formatTimeRange(reservation.startsAt, reservation.endsAt);
			} else {
				const form = el.closest('form');
				if (form) {
					const fd = new FormData(form);
					date = fd.get('date') as string;
					startTime = fd.get('startTime') as string;
					endTime = fd.get('endTime') as string;
					if (date && startTime) {
						const startIso = `${date}T${startTime}:00`;
						const endIso = endTime ? `${date}T${endTime}:00` : startIso;
						dateLabel = fullDate(startIso);
						timeLabel = formatTimeRange(startIso, endIso);
					}
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

	function confirmWithoutPayment() {
		if (skipPaymentInput) {
			skipPaymentInput.value = 'on';
		}
		formCtx.submit();
	}
</script>

<div bind:this={el}>
	<Form.Step>
		{#if reservation}
			<input type="hidden" name="id" value={reservation.id} />
		{/if}
		<input type="hidden" name="skipPayment" value="" bind:this={skipPaymentInput} />

		<div class="rounded-lg border border-base-300 bg-base-200/50 px-4 py-3">
			{#if dateLabel}
				<p class="font-medium">{dateLabel}</p>
				<p class="text-sm opacity-70">{timeLabel}</p>
			{:else}
				<div class="skeleton h-5 w-48"></div>
			{/if}
		</div>

		{#if !pricing}
			<div class="flex justify-between py-2">
				<div class="skeleton h-5 w-32"></div>
				<div class="skeleton h-5 w-16"></div>
			</div>
		{:else}
			<div class="flex justify-between py-2 text-sm">
				<span>{pricing.durationHours} hr × ${cents(pricing.hourlyRateCents)}/hr</span>
				{#if pricing.remainingCents < pricing.totalCents}
					<span class="text-success">${cents(pricing.remainingCents)} due</span>
				{:else}
					<span>${cents(pricing.totalCents)}</span>
				{/if}
			</div>
		{/if}

		<div class="flex justify-end gap-2 pt-2">
			<button type="button" class="btn btn-ghost" onclick={confirmWithoutPayment}>
				Confirm
			</button>
			<button type="button" class="btn btn-primary" onclick={() => formCtx.next()}>
				Pay Ahead
			</button>
		</div>
	</Form.Step>
</div>
