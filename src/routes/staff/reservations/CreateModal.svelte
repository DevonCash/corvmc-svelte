<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import {
		searchMembers,
		getStaffSlots,
		checkConflicts,
		createReservation
	} from '$lib/remote/reservations.remote';
	import Action from '$lib/components/shared/Action.svelte';
	import { toast } from 'svelte-sonner';
	import { Field } from '$lib/components/shared/Form';
	import SearchSelect from '$lib/components/shared/Form/SearchSelect.svelte';
	import ConflictWarnings from '$lib/components/shared/reservations/ConflictWarnings.svelte';
	import { formatSlotTime } from '$lib/utils/format';

	const { fields } = createReservation;

	let selectedMember = $state<{ id: string; name: string; email: string } | null>(null);
	let date = $state(new Date().toISOString().split('T')[0]);
	let startTime = $state('');
	let endTime = $state('');
	let notes = $state('');

	const startOptions = $derived.by(async () => {
		const data = await getStaffSlots(date);
		return data.slots.map((s) => ({
			value: s.startTime,
			label: formatSlotTime(s.startTime),
			available: s.available
		}));
	});

	const endOptions = $derived.by(async () => {
		if (!startTime) return [];
		const data = await getStaffSlots(date);

		const opts: Array<{ value: string; label: string; available: boolean }> = [];
		const startIdx = data.slots.findIndex((s) => s.startTime === startTime);
		if (startIdx < 0) return [];

		const slotsPerHour = 60 / data.config.slotMinutes;
		const minSlots = data.config.minDurationHours * slotsPerHour;
		const maxSlots = data.config.maxDurationHours * slotsPerHour;

		for (let i = minSlots; i <= maxSlots; i++) {
			const slotIdx = startIdx + i;
			if (slotIdx > data.slots.length) break;

			const endSlot = slotIdx < data.slots.length ? data.slots[slotIdx] : null;
			const time = endSlot?.startTime ?? addMinutes(startTime, i * data.config.slotMinutes);
			const rangeAvailable = data.slots.slice(startIdx, slotIdx).every((s) => s.available);

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
	action={createReservation}
	label="New Reservation"
	modalTitle="New Reservation"
	submitLabel="Create Reservation"
	class="btn-primary btn-sm"
	maxWidth="max-w-md"
	onsuccess={async (result) => {
		resetForm();
		const r = result as { reservationId?: string };
		await invalidateAll();
		if (r?.reservationId) goto(`/staff/reservations/${r.reservationId}`);
	}}
>
	{#snippet form({ close })}
		<svelte:boundary>
			<input {...fields.memberId.as('hidden', selectedMember?.id ?? '')} />
			<input {...fields.date.as('hidden', date)} />
			<input {...fields.startTime.as('hidden', startTime)} />
			<input {...fields.endTime.as('hidden', endTime)} />
			<input {...fields.notes.as('hidden', notes)} />

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
					disabled={!(await startOptions)?.length}
				>
					<option value="">Select start time</option>
					{#each await startOptions as opt (opt.value)}
						<option value={opt.value}>
							{opt.label}{opt.available ? '' : ' ⚠ conflict'}
						</option>
					{/each}
				</select>
			</fieldset>

			<fieldset class="fieldset">
				<legend class="fieldset-legend">End time</legend>
				<select bind:value={endTime} class="select-bordered select w-full" disabled={!startTime}>
					<option value="">Select end time</option>
					{#each await endOptions as opt (opt.value)}
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
