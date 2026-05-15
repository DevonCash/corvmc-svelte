<script lang="ts">
	import { formatSlotTime, toLocalTime } from '$lib/utils/format';

	type Conflict = {
		type: 'reservation' | 'closure';
		startsAt: Date | string;
		endsAt: Date | string;
		label: string;
	};

	type ConflictResult = {
		conflicts: Conflict[];
		validationWarnings: string[];
	};

	let {
		date,
		startTime,
		endTime,
		checkConflicts,
		excludeReservationId,
		hasConflicts = $bindable(false)
	}: {
		date: string;
		startTime: string;
		endTime: string;
		checkConflicts: (params: {
			date: string;
			startTime: string;
			endTime: string;
			excludeReservationId?: string;
		}) => Promise<ConflictResult>;
		excludeReservationId?: string;
		hasConflicts?: boolean;
	} = $props();

	const conflictData = $derived(
		date && startTime && endTime
			? await checkConflicts({ date, startTime, endTime, excludeReservationId })
			: null
	);

	const warnings = $derived.by(() => {
		if (!conflictData) return [];
		const msgs: string[] = [];

		for (const c of conflictData.conflicts) {
			const start = typeof c.startsAt === 'string' ? c.startsAt : c.startsAt.toISOString();
			const end = typeof c.endsAt === 'string' ? c.endsAt : c.endsAt.toISOString();
			const range = `${formatSlotTime(toLocalTime(start))} – ${formatSlotTime(toLocalTime(end))}`;

			if (c.type === 'reservation') {
				msgs.push(`Conflicts with reservation: ${c.label}, ${range}`);
			} else {
				msgs.push(`Overlaps with closure: ${c.label}`);
			}
		}

		msgs.push(...conflictData.validationWarnings);
		return msgs;
	});

	$effect(() => {
		hasConflicts = warnings.length > 0;
	});
</script>

<svelte:boundary>
	{#if warnings.length > 0}
		<div class="space-y-2">
			{#each warnings as warning, i (i)}
				<div class="alert alert-warning text-sm py-2">
					{warning}
				</div>
			{/each}
		</div>
	{/if}

	{#snippet pending()}
		<div class="flex items-center gap-2 py-1">
			<span class="loading loading-spinner loading-xs"></span>
			<span class="text-xs opacity-60">Checking conflicts...</span>
		</div>
	{/snippet}
</svelte:boundary>
