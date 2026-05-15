<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { searchMembers, getSlots, checkConflicts, createReservation } from './data.remote';
	import Modal from '$lib/components/shared/Modal.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import SearchSelect from '$lib/components/shared/Form/SearchSelect.svelte';
	import ConflictWarnings from '$lib/components/shared/ConflictWarnings.svelte';
	import { formatSlotTime } from '$lib/utils/format';

	let open = $state(false);

	// Form state
	let selectedMember = $state<{ id: string; name: string; email: string } | null>(null);
	let date = $state(new Date().toISOString().split('T')[0]);
	let startTime = $state('');
	let endTime = $state('');
	let notes = $state('');
	let submitting = $state(false);

	const slotData = $derived(await getSlots(date));

	// Slot options for selects
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

	async function handleSubmit() {
		if (!selectedMember || !date || !startTime || !endTime) return;
		submitting = true;

		try {
			const result = await createReservation({
				memberId: selectedMember.id,
				date,
				startTime,
				endTime,
				notes: notes || undefined
			});

			toast.success('Reservation created');
			open = false;
			resetForm();
			await invalidateAll();

			if (result?.reservationId) {
				goto(`/staff/reservations/${result.reservationId}`);
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to create reservation');
		} finally {
			submitting = false;
		}
	}

	function resetForm() {
		selectedMember = null;
		date = new Date().toISOString().split('T')[0];
		startTime = '';
		endTime = '';
		notes = '';
	}

	function close() {
		open = false;
	}
</script>

<button class="btn btn-sm btn-primary" onclick={() => (open = true)}>
	New Reservation
</button>
<Modal bind:open title="New Reservation" maxWidth="max-w-md" onclose={resetForm}>
	<svelte:boundary>
		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
			class="space-y-4"
		>
			<!-- Member -->
			<FormField label="Member" id="member" issues={[]}>
				<SearchSelect
					search={searchMembers}
					bind:value={selectedMember}
					placeholder="Search by name or email..."
				/>
			</FormField>

			<!-- Date -->
			<FormField label="Date" id="date" issues={[]}>
				<input type="date" id="date" bind:value={date} class="input-bordered input w-full" />
			</FormField>

			<!-- Start time -->
			<FormField label="Start time" id="startTime" issues={[]}>
				<select
					id="startTime"
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
			</FormField>

			<!-- End time -->
			<FormField label="End time" id="endTime" issues={[]}>
				<select
					id="endTime"
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
			</FormField>

			<!-- Conflict warnings -->
			<ConflictWarnings {date} {startTime} {endTime} {checkConflicts} />

			<!-- Notes -->
			<FormField label="Notes" id="notes" issues={[]}>
				<textarea
					id="notes"
					bind:value={notes}
					placeholder="Optional notes..."
					class="textarea-bordered textarea w-full"
					rows="2"
				></textarea>
			</FormField>

			<!-- Footer -->
			<div class="modal-action">
				<button type="button" class="btn btn-ghost" onclick={close}>Cancel</button>
				<button
					type="submit"
					class="btn btn-success"
					disabled={!selectedMember || !date || !startTime || !endTime || submitting}
				>
					{#if submitting}
						<span class="loading loading-sm loading-spinner"></span>
					{/if}
					Create Reservation
				</button>
			</div>
		</form>
		{#snippet pending()}
			<div class="flex items-center justify-center p-8">
				<span class="loading loading-md loading-spinner"></span>
			</div>
		{/snippet}
	</svelte:boundary>
</Modal>
