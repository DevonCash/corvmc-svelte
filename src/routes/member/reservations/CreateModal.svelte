<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { base } from '$app/paths';
	import {
		getAvailableDates,
		getMemberSlots,
		getMembershipStatus,
		bookAndPayReservation
	} from '$lib/remote/reservations.remote';
	import * as Form from '$lib/components/shared/Form';
	import Action from '$lib/components/shared/Action.svelte';
	import { formatSlotTime } from '$lib/utils/format';
	import { IconCalendarPlus } from '@tabler/icons-svelte';
	import { today, getLocalTimeZone, type DateValue } from '@internationalized/date';

	const tz = getLocalTimeZone();

	let availableDates = $derived(await getAvailableDates());
	const availableSet = $derived(new Set(availableDates));

	const minDate = $derived(today(tz));
	const maxDate = $derived(today(tz).add({ days: 14 }));

	function isDateUnavailable(d: DateValue): boolean {
		if (d.compare(minDate) < 0 || d.compare(maxDate) > 0) return false;
		return !availableSet.has(d.toString());
	}

	let date = $state(today(tz).toString());
	let startTime = $state('');
	let endTime = $state('');
	let notes = $state('');
	let recurring = $state('');
	let coverFees = $state(false);

	let slotData = $derived(await getMemberSlots(date));
	const slots = $derived(slotData.slots);
	const config = $derived(slotData.config);

	let membershipStatus = $derived(await getMembershipStatus());
	const isSustainingMember = $derived(membershipStatus.isSustainingMember);
	const freeHoursBalance = $derived(membershipStatus.freeHoursBalance);

	const minSlots = $derived(config.minDurationHours * (60 / config.slotMinutes));
	const maxSlots = $derived(config.maxDurationHours * (60 / config.slotMinutes));

	function contiguousFrom(startIdx: number): number {
		let count = 0;
		for (let i = startIdx; i < slots.length && slots[i].available; i++) {
			count++;
		}
		return count;
	}

	const startTimeOptions = $derived(
		slots
			.filter((s, i) => s.available && contiguousFrom(i) >= minSlots)
			.map((s) => ({ value: s.startTime, label: formatSlotTime(s.startTime) }))
	);

	const endTimeOptions = $derived.by(() => {
		if (!startTime) return [];

		const startIdx = slots.findIndex((s) => s.startTime === startTime);
		if (startIdx === -1) return [];

		const ends: { value: string; label: string }[] = [];
		const run = Math.min(contiguousFrom(startIdx), maxSlots);

		for (let i = 0; i < run; i++) {
			if (i + 1 >= minSlots) {
				const t = slots[startIdx + i].endTime;
				ends.push({ value: t, label: formatSlotTime(t) });
			}
		}

		return ends;
	});

	const durationHours = $derived.by(() => {
		if (!startTime || !endTime) return 0;
		const [sh, sm] = startTime.split(':').map(Number);
		const [eh, em] = endTime.split(':').map(Number);
		return (eh * 60 + em - (sh * 60 + sm)) / 60;
	});

	// Pricing (computed client-side for step 2)
	const totalCents = $derived(Math.round(durationHours * config.hourlyRateCents));
	const creditsApplicable = $derived(Math.min(freeHoursBalance, durationHours));
	const creditDiscountCents = $derived(
		durationHours > 0 ? creditsApplicable * (totalCents / durationHours) : 0
	);
	const remainingCents = $derived(totalCents - creditDiscountCents);

	function calcFeeCents(baseCents: number): number {
		if (baseCents <= 0) return 0;
		return Math.ceil((baseCents + 30) / (1 - 0.029)) - baseCents;
	}

	const feeCents = $derived(coverFees ? calcFeeCents(remainingCents) : 0);
	const chargeTotal = $derived(remainingCents + feeCents);

	function cents(amount: number): string {
		return (amount / 100).toFixed(2);
	}

	const payLabel = $derived(
		remainingCents <= 0 ? 'Confirm (Free Hours)' : `Pay $${cents(chargeTotal)}`
	);

	const step1Valid = $derived(!!date && !!startTime && !!endTime);

	$effect(() => {
		void date;
		startTime = '';
		endTime = '';
	});

	$effect(() => {
		void startTime;
		endTime = '';
	});

	function resetForm() {
		date = today(tz).toString();
		startTime = '';
		endTime = '';
		notes = '';
		recurring = '';
		coverFees = false;
	}
</script>

<Action
	action={bookAndPayReservation}
	label="Reserve Space"
	modalTitle="Book a Session"
	noFooter
	class="btn-primary"
	maxWidth="max-w-md"
	onsuccess={async (result) => {
		resetForm();
		const r = result as { reservationId?: string; paid?: boolean; redirectUrl?: string };
		if (r?.redirectUrl) {
			window.location.href = r.redirectUrl;
		} else {
			await invalidateAll();
		}
	}}
>
	{#snippet icon()}<IconCalendarPlus size={18} />{/snippet}
	{#snippet form({ close })}
		<svelte:boundary>
			<Form.Step valid={step1Valid}>
				<Form.Field
					name="date"
					label=""
					type="calendar"
					bind:value={date}
					isDateUnavailable={isDateUnavailable}
					minValue={minDate}
					maxValue={maxDate}
				/>

				{#if date && startTimeOptions.length === 0}
					<p class="mt-2 text-sm text-error">No available times on this date. Please select another day.</p>
				{/if}

				<div class="grid grid-cols-2 gap-2">
					<Form.Field
						name="startTime"
						label="Start time"
						type="select"
						bind:value={startTime}
						options={startTimeOptions}
						placeholder={startTimeOptions.length === 0 ? 'No times available' : 'Select a start time'}
						readonly={startTimeOptions.length === 0}
						required
					/>

					<Form.Field
						name="endTime"
						label="End time"
						type="select"
						bind:value={endTime}
						options={endTimeOptions}
						placeholder={!startTime ? 'Select a start time first' : endTimeOptions.length === 0 ? 'No end times available' : 'Select an end time'}
						readonly={endTimeOptions.length === 0}
						required
					/>
				</div>

				<Form.Field
					name="notes"
					label="Notes (optional)"
					type="textarea"
					bind:value={notes}
					placeholder="What are you working on?"
					rows={2}
				/>

				{#if isSustainingMember}
					<Form.Field
						name="recurring"
						label="Repeat this reservation"
						type="select"
						bind:value={recurring}
						options={[
							{ value: '', label: "Don't repeat (one-time)" },
							{ value: 'weekly', label: 'Weekly' },
							{ value: 'biweekly', label: 'Every 2 weeks' },
							{ value: 'monthly', label: 'Monthly' }
						]}
					/>
					{#if recurring}
						<p class="text-sm mt-1 opacity-60">
							Future instances will be generated automatically. You'll confirm and pay
							for each one individually.
						</p>
					{/if}
				{/if}
			</Form.Step>

			<Form.Step>
				<div class="space-y-2">
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

				{#if remainingCents > 0}
					<Form.Field name="coverFees" label="" type="checkbox" bind:value={coverFees} checkboxLabel="Cover ${cents(calcFeeCents(remainingCents))} processing fee so the Collective receives 100%" />
				{/if}

				{#if !isSustainingMember}
					<div class="mt-2 rounded-box border border-base-300 bg-base-200 px-4 py-3 text-sm">
						Sustaining members get free rehearsal hours every month.
						<a href="{base}/member/membership" target="_blank" class="link link-primary">Learn more</a>
					</div>
				{/if}
			</Form.Step>

			<div class="flex justify-end pt-2">
				<Form.SubmitButton
					label={payLabel}
					continueLabel="Continue to Payment"
					class="btn-primary"
				/>
			</div>

			{#snippet pending()}
				<div class="flex items-center justify-center p-8">
					<span class="loading loading-md loading-spinner"></span>
				</div>
			{/snippet}
		</svelte:boundary>
	{/snippet}
</Action>
