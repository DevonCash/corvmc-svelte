<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Combobox } from 'bits-ui';
	import { searchMembers, getSlots, checkConflicts, createReservation } from './data.remote';
	import Modal from '$lib/components/shared/Modal.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import { formatSlotTime, toLocalTime } from '$lib/utils/format';

	let open = $state(false);

	// Form state
	let memberSearch = $state('');
	let selectedMember = $state<{ id: string; name: string; email: string } | null>(null);
	let date = $state(new Date().toISOString().split('T')[0]);
	let startTime = $state('');
	let endTime = $state('');
	let notes = $state('');
	let submitting = $state(false);

	// Member search — drive remote query from combobox input
	let memberComboValue = $state<string[]>([]);
	const memberResults = $derived(memberSearch.length >= 2 ? await searchMembers(memberSearch) : []);
	const slotData = $derived(await getSlots(date));
	const conflictData = $derived(
		startTime && endTime ? await checkConflicts({ date, startTime, endTime }) : null
	);

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

		// Generate end times: 1 to 8 hours after start, in 30-min increments
		const slotsPerHour = 60 / slotData.config.slotMinutes;
		const minSlots = slotData.config.minDurationHours * slotsPerHour;
		const maxSlots = slotData.config.maxDurationHours * slotsPerHour;

		for (let i = minSlots; i <= maxSlots; i++) {
			const slotIdx = startIdx + i;
			if (slotIdx > slotData.slots.length) break;

			const endSlot = slotIdx < slotData.slots.length ? slotData.slots[slotIdx] : null;
			const time = endSlot?.startTime ?? addMinutes(startTime, i * slotData.config.slotMinutes);

			// Check if any slot in the range is unavailable
			const rangeAvailable = slotData.slots.slice(startIdx, slotIdx).every((s) => s.available);

			opts.push({
				value: time,
				label: formatSlotTime(time),
				available: rangeAvailable
			});
		}

		return opts;
	});

	// Warnings
	const warnings = $derived.by(() => {
		if (!conflictData) return [];

		const msgs: string[] = [];

		for (const c of conflictData.conflicts) {
			if (c.type === 'reservation') {
				const range = `${formatSlotTime(toLocalTime(c.startsAt.toISOString()))} – ${formatSlotTime(toLocalTime(c.endsAt.toISOString()))}`;
				msgs.push(`Conflicts with existing reservation: ${c.label}, ${range}`);
			} else {
				msgs.push(`Overlaps with closure: ${c.label}`);
			}
		}

		msgs.push(...conflictData.validationWarnings);
		return msgs;
	});

	function addMinutes(time: string, minutes: number): string {
		const [h, m] = time.split(':').map(Number);
		const total = h * 60 + m + minutes;
		return `${Math.floor(total / 60)
			.toString()
			.padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
	}

	// When combobox value changes, look up the member from results
	$effect(() => {
		if (memberComboValue.length > 0) {
			const id = memberComboValue[0];
			const found = memberResults.find((m) => m.id === id);
			if (found) {
				selectedMember = found;
				memberSearch = '';
			}
		}
	});

	function clearMember() {
		selectedMember = null;
		memberComboValue = [];
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
		memberSearch = '';
		memberComboValue = [];
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
				{#if selectedMember}
					<div class="flex items-center gap-2">
						<div class="badge gap-2 badge-lg">
							{selectedMember.name}
							<button type="button" class="btn btn-circle btn-ghost btn-xs" onclick={clearMember}
								>✕</button
							>
						</div>
						<span class="text-sm opacity-60">{selectedMember.email}</span>
					</div>
				{:else}
					<Combobox.Root type="multiple" bind:value={memberComboValue} inputValue={memberSearch}>
						<div class="relative">
							<Combobox.Input
								placeholder="Search by name or email..."
								class="input-bordered input w-full"
								oninput={(e: Event) => {
									memberSearch = (e.target as HTMLInputElement).value;
								}}
							/>
							<Combobox.Content
								class="menu z-10 max-h-40 w-full overflow-y-auto rounded-box bg-base-100 p-1 shadow-lg"
								sideOffset={4}
							>
								{#each memberResults as m (m.id)}
									<Combobox.Item
										value={m.id}
										label={m.name}
										class="rounded-btn cursor-pointer px-3 py-2 data-[highlighted]:bg-base-200"
									>
										<span class="font-medium">{m.name}</span>
										<span class="ml-2 text-sm opacity-60">{m.email}</span>
									</Combobox.Item>
								{:else}
									{#if memberSearch.length >= 2}
										<div class="px-3 py-2 opacity-60">No members found</div>
									{:else}
										<div class="px-3 py-2 opacity-60">Type to search...</div>
									{/if}
								{/each}
							</Combobox.Content>
						</div>
					</Combobox.Root>
				{/if}
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

			<!-- Override warnings -->
			{#if warnings.length > 0}
				<div class="space-y-2">
					{#each warnings as warning, i (i)}
						<div class="alert py-2 text-sm alert-warning">
							{warning}
						</div>
					{/each}
				</div>
			{/if}

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
