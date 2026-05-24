<script lang="ts">
	import { getReservationPricing, previewRecurringInstances } from '$lib/remote/reservations.remote';
	import { getFormContext } from '$lib/components/shared/Form/Form.svelte';
	import * as Form from '$lib/components/shared/Form';
	import Button from '$lib/components/shared/Button.svelte';
	import { fullDate, formatTimeRange, formatScheduleLabel, formatSlotTime } from '$lib/utils/format';
	import type { ISODateString } from '$lib/server/db/schema/columns';

	let {
		reservation
	}: {
		reservation?: { id: string; startsAt: ISODateString; endsAt: ISODateString };
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
	let recurringFrequency = $state('');
	let recurringPreview = $state<{ dates: string[]; totalInWindow: number } | null>(null);
	let scheduleLabel = $state('');

	const isRecurring = $derived(recurringFrequency !== '');

	function cents(amount: number): string {
		return (amount / 100).toFixed(2);
	}

	function formatPreviewDate(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleDateString('en-US', {
			timeZone: 'America/Los_Angeles',
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
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
				recurringFrequency = '';
			} else {
				const form = el.closest('form');
				if (form) {
					const fd = new FormData(form);
					date = fd.get('date') as string;
					startTime = fd.get('startTime') as string;
					endTime = fd.get('endTime') as string;
					recurringFrequency = (fd.get('recurring') as string) || '';
					const seriesEndsAt = (fd.get('seriesEndsAt') as string) || undefined;
					if (date && startTime) {
						const startIso = `${date}T${startTime}:00` as ISODateString;
						const endIso = (endTime ? `${date}T${endTime}:00` : startIso) as ISODateString;
						dateLabel = fullDate(startIso);
						timeLabel = formatTimeRange(startIso, endIso);
					}

					if (recurringFrequency && date && startTime) {
						const freqLabel =
							recurringFrequency === 'weekly'
								? 'Weekly'
								: recurringFrequency === 'biweekly'
									? 'Every 2 weeks'
									: 'Monthly';
						scheduleLabel = formatScheduleLabel(freqLabel, `${date}T${startTime}:00` as ISODateString);
						recurringPreview = null;
						previewRecurringInstances({
							date,
							startTime,
							frequency: recurringFrequency as 'weekly' | 'biweekly' | 'monthly',
							endsAt: seriesEndsAt
						}).then((result) => {
							recurringPreview = result;
						});
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

		{#if isRecurring}
			<div class="rounded-lg border border-base-300 bg-base-200/50 px-4 py-3 mt-2">
				{#if scheduleLabel}
					<p class="text-sm font-medium">{scheduleLabel}</p>
				{/if}
				<div class="mt-2">
					<p class="mb-1 text-xs font-medium opacity-70">Upcoming instances</p>
					{#if !recurringPreview}
						<div class="space-y-1">
							{#each Array(3) as _, i (i)}
								<div class="skeleton h-4 w-36 rounded"></div>
							{/each}
						</div>
					{:else if recurringPreview.dates.length === 0}
						<p class="text-xs opacity-60">No upcoming instances in the next 60 days.</p>
					{:else}
						<ul class="space-y-0.5 text-xs">
							{#each recurringPreview.dates as iso (iso)}
								<li class="opacity-70">{formatPreviewDate(iso)}</li>
							{/each}
						</ul>
						{#if recurringPreview.totalInWindow > recurringPreview.dates.length}
							<p class="mt-1 text-xs opacity-50">
								and {recurringPreview.totalInWindow - recurringPreview.dates.length} more...
							</p>
						{/if}
					{/if}
				</div>
				<p class="mt-2 text-xs opacity-50">
					Future instances are generated automatically. You'll confirm each one individually.
				</p>
			</div>
		{/if}

		<div class="flex justify-end gap-2 pt-2">
			<Button type="button" class="btn-ghost" onclick={confirmWithoutPayment}>
				Confirm
			</Button>
			<Button type="button" onclick={() => formCtx.next()}>
				Pay Ahead
			</Button>
		</div>
	</Form.Step>
</div>
