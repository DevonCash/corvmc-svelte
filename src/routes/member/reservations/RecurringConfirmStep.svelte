<script lang="ts">
	import { previewRecurringInstances } from '$lib/remote/reservations.remote';
	import { getFormContext } from '$lib/components/shared/Form/Form.svelte';
	import * as Form from '$lib/components/shared/Form';
	import { formatScheduleLabel, formatSlotTime, fullDate } from '$lib/utils/format';

	const formCtx = getFormContext()!;

	let el: HTMLDivElement;

	let preview = $state<{ dates: string[]; totalInWindow: number } | null>(null);
	let summaryLabel = $state('');
	let timeLabel = $state('');
	let startDateLabel = $state('');
	let endDateLabel = $state('');

	$effect(() => {
		if (formCtx.currentStep === 1 && el) {
			const form = el.closest('form');
			if (!form) return;
			const fd = new FormData(form);
			const date = fd.get('date') as string;
			const startTime = fd.get('startTime') as string;
			const endTime = fd.get('endTime') as string;
			const recurring = fd.get('recurring') as string;
			const seriesEndsAt = (fd.get('seriesEndsAt') as string) || undefined;

			if (!date || !startTime || !endTime || !recurring) return;

			const freqLabel =
				recurring === 'weekly'
					? 'Weekly'
					: recurring === 'biweekly'
						? 'Every 2 weeks'
						: 'Monthly';
			const iso = `${date}T${startTime}:00`;
			summaryLabel = formatScheduleLabel(freqLabel, iso);
			timeLabel = `${formatSlotTime(startTime)} – ${formatSlotTime(endTime)}`;
			startDateLabel = fullDate(`${date}T12:00:00`);
			endDateLabel = seriesEndsAt ? fullDate(`${seriesEndsAt}T12:00:00`) : '';

			preview = null;
			previewRecurringInstances({
				date,
				startTime,
				frequency: recurring as 'weekly' | 'biweekly' | 'monthly',
				endsAt: seriesEndsAt
			}).then((result) => {
				preview = result;
			});
		}
	});

	function formatPreviewDate(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleDateString('en-US', {
			timeZone: 'America/Los_Angeles',
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<div bind:this={el}>
	<Form.Step>
		<div class="rounded-lg border border-base-300 bg-base-200/50 px-4 py-3">
			{#if summaryLabel}
				<p class="font-medium">{summaryLabel}</p>
				<p class="text-sm opacity-70">{timeLabel}</p>
				<p class="mt-1 text-sm opacity-60">
					Starting {startDateLabel}{#if endDateLabel}&ensp;·&ensp;until {endDateLabel}{/if}
				</p>
			{:else}
				<div class="skeleton h-5 w-48"></div>
			{/if}
		</div>

		<div class="mt-3">
			<p class="mb-2 text-sm font-medium">Upcoming instances</p>
			{#if !preview}
				<div class="space-y-1">
					{#each Array(4) as _, i (i)}
						<div class="skeleton h-5 w-40 rounded"></div>
					{/each}
				</div>
			{:else if preview.dates.length === 0}
				<p class="text-sm opacity-60">No upcoming instances in the next 60 days.</p>
			{:else}
				<ul class="space-y-0.5 text-sm">
					{#each preview.dates as iso (iso)}
						<li class="opacity-70">{formatPreviewDate(iso)}</li>
					{/each}
				</ul>
				{#if preview.totalInWindow > preview.dates.length}
					<p class="mt-1 text-xs opacity-50">
						and {preview.totalInWindow - preview.dates.length} more...
					</p>
				{/if}
			{/if}
		</div>

		<p class="mt-3 text-xs opacity-50">
			Future instances are generated automatically. You'll confirm each one individually.
		</p>

		<div class="flex justify-end pt-2">
			<Form.SubmitButton label="Create Series" class="btn-primary" />
		</div>
	</Form.Step>
</div>
