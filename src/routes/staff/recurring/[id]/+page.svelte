<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { formatTimeRange, formatDate } from '$lib/utils/format';
	import { toISO } from '$lib/types/dates';
	import Badge from '$lib/components/shared/Badge.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import { getSeries, getSeriesHistory, cancelDetailSeries, editStaffSeries } from '$lib/remote/recurring.remote';
	const { fields: cancelFields } = cancelDetailSeries;
	const { fields: editFields } = editStaffSeries;

	let id = $derived(page.params.id!);
	let series = $derived(await getSeries(id));
	let history = $derived(await getSeriesHistory(id));

	let isActive = $derived(!series.cancelledAt);

	// Edit state
	let editing = $state(false);
	let editDate = $state('');
	let editStartTime = $state('');
	let editEndTime = $state('');
	let editFrequency = $state<'weekly' | 'biweekly' | 'monthly'>('weekly');
	let overrideConflicts = $state(false);

	function startEditing() {
		const start = new Date(series.prototypeStartsAt);
		const end = new Date(series.prototypeEndsAt);
		editDate = start.toISOString().slice(0, 10);
		editStartTime = start.toTimeString().slice(0, 5);
		editEndTime = end.toTimeString().slice(0, 5);
		// Parse frequency from rrule
		const rrule = series.rrule.toUpperCase();
		if (rrule.includes('INTERVAL=2')) editFrequency = 'biweekly';
		else if (rrule.includes('MONTHLY')) editFrequency = 'monthly';
		else editFrequency = 'weekly';
		overrideConflicts = false;
		editing = true;
	}
</script>

<PageHeader title="Recurring Series" backHref="/staff/recurring">
	{#if isActive}
		<div class="flex gap-2">
			<Button class="btn-sm btn-ghost" onclick={startEditing}>Edit Schedule</Button>
			<Action
				action={cancelDetailSeries}
				label="Cancel Series"
				modalTitle="Confirm"
				successToast="Series cancelled"
				class="btn-error btn-outline btn-sm"
				onsuccess={() => invalidateAll()}
			>
				{#snippet form({ close })}
					<input {...cancelFields.seriesId.as('hidden', id)} />
					<p class="py-4">Cancel this recurring series? No new reservations will be generated.</p>
				{/snippet}
			</Action>
		</div>
	{/if}
</PageHeader>
<PageContent width="3xl">

	<div class="flex items-center gap-2 mb-4">
		{#if series.cancelledAt}
			<StatusBadge status="cancelled" />
		{:else}
			<StatusBadge status="active" />
		{/if}
	</div>

	<!-- Current schedule -->
	<InfoCard title="Schedule">
		<dl class="grid gap-x-4 gap-y-2 text-sm" style="grid-template-columns: auto 1fr;">
			<dt class="opacity-60">RRULE</dt>
			<dd class="font-mono text-xs">{series.rrule}</dd>

			<dt class="opacity-60">Prototype Time</dt>
			<dd>{formatTimeRange(toISO(series.prototypeStartsAt), toISO(series.prototypeEndsAt))}</dd>

			<dt class="opacity-60">Booker</dt>
			<dd>{series.prototypeBookerType}: {series.prototypeBookerId}</dd>

			{#if series.prototypeNotes}
				<dt class="opacity-60">Notes</dt>
				<dd>{series.prototypeNotes}</dd>
			{/if}

			<dt class="opacity-60">Created</dt>
			<dd>{formatDate(toISO(series.createdAt))}</dd>

			{#if series.cancelledAt}
				<dt class="opacity-60">Cancelled</dt>
				<dd>{formatDate(toISO(series.cancelledAt))}</dd>
			{/if}
		</dl>
	</InfoCard>

	<!-- Edit form -->
	{#if editing}
		<InfoCard title="Edit Schedule">
			<p class="text-sm opacity-60 mb-4">This will supersede the current series with a new schedule. The old series is preserved in history.</p>
			<Form
				remote={editStaffSeries}
				successToast="Series schedule updated"
				onsuccess={() => { editing = false; invalidateAll(); }}
			>
				<input {...editFields.seriesId.as('hidden', id)} />
				<div class="space-y-4">
					<label class="form-control w-full">
						<div class="label"><span class="label-text">Day (first occurrence)</span></div>
						<input type="date" name="date" class="input input-bordered w-full" bind:value={editDate} />
					</label>
					<div class="grid grid-cols-2 gap-4">
						<label class="form-control w-full">
							<div class="label"><span class="label-text">Start time</span></div>
							<input type="time" name="startTime" class="input input-bordered w-full" bind:value={editStartTime} />
						</label>
						<label class="form-control w-full">
							<div class="label"><span class="label-text">End time</span></div>
							<input type="time" name="endTime" class="input input-bordered w-full" bind:value={editEndTime} />
						</label>
					</div>
					<label class="form-control w-full">
						<div class="label"><span class="label-text">Frequency</span></div>
						<select name="frequency" class="select select-bordered w-full" bind:value={editFrequency}>
							<option value="weekly">Weekly</option>
							<option value="biweekly">Biweekly</option>
							<option value="monthly">Monthly</option>
						</select>
					</label>
					<label class="label cursor-pointer justify-start gap-3">
						<input type="checkbox" name="overrideConflicts" checked={overrideConflicts} class="checkbox checkbox-sm" />
						<span class="label-text">Override conflicts</span>
					</label>
					<div class="flex justify-end gap-2">
						<Button type="button" class="btn-ghost btn-sm" onclick={() => (editing = false)}>Cancel</Button>
						<SubmitButton label="Save New Schedule" class="btn-primary btn-sm" />
					</div>
				</div>
			</Form>
		</InfoCard>
	{/if}

	<!-- History -->
	{#if history.length > 1}
		<InfoCard title="Supersession History">
			<div class="space-y-2">
				{#each history as h, i}
					<div class="flex items-center gap-3 text-sm" class:opacity-50={i > 0}>
						<span class="font-mono text-xs">{h.id.slice(0, 8)}</span>
						<span class="font-mono text-xs flex-1">{h.rrule}</span>
						<span>{formatDate(toISO(h.createdAt))}</span>
						{#if h.cancelledAt}
							<StatusBadge status="cancelled" />
						{:else if h.supersededBy}
							<Badge variant="ghost">superseded</Badge>
						{:else}
							<StatusBadge status="active" />
						{/if}
					</div>
				{/each}
			</div>
		</InfoCard>
	{/if}
</PageContent>
