<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { searchMembers, getSlots, checkConflicts, createReservation } from './data.remote';
	import Action from '$lib/components/shared/Action.svelte';
	import { Field } from '$lib/components/shared/Form';
	import SearchSelect from '$lib/components/shared/Form/SearchSelect.svelte';
	import ConflictWarnings from '$lib/components/shared/ConflictWarnings.svelte';
	import { formatSlotTime } from '$lib/utils/format';

	let selectedMember = $state<{ id: string; name: string; email: string } | null>(null);
	let date = $state(new Date().toISOString().split('T')[0]);
	let startTime = $state('');
	let endTime = $state('');
	let notes = $state('');

	const slotData = $derived(await getSlots(date));

	const startOptions = $derived.by(() => {
		if (!slotData) return [];
		return slotData.slots.map((s) => ({
			value: s.startTime,
			label: formatSlotTime(s.startTime),
			available: s.available
		}));
	});

	const endOptions = $derived.by(() => {
		if (!startTime || !slotData) return [];

		const opts: Array<{ value: string; label: string; available: boolean }> = [];
		const startIdx = slotData.slots.findIndex((s) => s.startTime === startTime);
		if (startIdx < 0) return [];

		const slotsPerHour = 60 / slotData.config.slotMinutes;
		const minSlots = slotData.config.minDurationHours * slotsPerHour;
		const maxSlots = slotData.config.maxDurationHours * slotsPerHour;

		for (let i = minSlots; i <= maxSlots; i++) {
			const slotIdx = startIdx + i;
			if (slotIdx > slotData.slots.length) break;

			const endSlot = slotIdx < slotData.slots.length ? slotData.slots[slotIdx] : null;
			const time = endSlot?.startTime ?? addMinutes(startTime, i * slotData.config.slotMinutes);
			const rangeAvailable = slotData.slots.slice(startIdx, slotIdx).every((s) => s.available);

			opts.push({
				value: time,
				label: formatSlotTime(time),
				available: rangeAvailable
			});
		}

		return opts;
	});

	function addMinutes(time: string, minutes: number): string {
		const [h, m] = time.split(':').map(Number);
		const total = h * 60 + m + minutes;
		return `${Math.floor(total / 60)
			.toString()
			.padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
	}

	function resetForm() {
		selectedMember = null;
		date = new Date().toISOString().split('T')[0];
		startTime = '';
		endTime = '';
		notes = '';
	}
</script>

<Action
	action={async () => {
		const result = await createReservation({
			memberId: selectedMember!.id,
			date,
			startTime,
			endTime,
			notes: notes || undefined
		});
		resetForm();
		return result;
	}}
	label="New Reservation"
	modalTitle="New Reservation"
	submitLabel="Create Reservation"
	canSubmit={!!selectedMember && !!date && !!startTime && !!endTime}
	successToast="Reservation created"
	class="btn-primary btn-sm"
	maxWidth="max-w-md"
	onsuccess={async (result) => {
		const r = result as { reservationId?: string };
		await invalidateAll();
		if (r?.reservationId) goto(`/staff/reservations/${r.reservationId}`);
	}}
>
	{#snippet form({ close })}
		<svelte:boundary>
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Member</legend>
				<SearchSelect
					search={searchMembers}
					bind:value={selectedMember}
					placeholder="Search by name or email..."
				/>
			</fieldset>

			<Field name="date" type="date" label="Date" bind:value={date} />

			<fieldset class="fieldset">
				<legend class="fieldset-legend">Start time</legend>
				<select
					bind:value={startTime}
					class="select-bordered select w-full"
					disabled={!slotData}
				>
					<option value="">Select start time</option>
					{#each startOptions as opt (opt.value)}
						<option value={opt.value}>
							{opt.label}{opt.available ? '' : ' ⚠ conflict'}
						</option>
					{/each}
				</select>
			</fieldset>

			<fieldset class="fieldset">
				<legend class="fieldset-legend">End time</legend>
				<select
					bind:value={endTime}
					class="select-bordered select w-full"
					disabled={!startTime}
				>
					<option value="">Select end time</option>
					{#each endOptions as opt (opt.value)}
						<option value={opt.value} class:opacity-40={!opt.available}>
							{opt.label}{opt.available ? '' : ' (unavailable)'}
						</option>
					{/each}
				</select>
			</fieldset>

			<ConflictWarnings {date} {startTime} {endTime} {checkConflicts} />

			<Field name="notes" type="textarea" label="Notes" bind:value={notes} />

			{#snippet pending()}
				<div class="flex items-center justify-center p-8">
					<span class="loading loading-md loading-spinner"></span>
				</div>
			{/snippet}
		</svelte:boundary>
	{/snippet}
</Action>
