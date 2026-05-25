<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import { formatTimeRange, formatDate } from '$lib/utils/format';
	import Badge from '$lib/components/shared/Badge.svelte';
	import { getSeries, getSeriesHistory, cancelDetailSeries } from '$lib/remote/recurring.remote';
	const { fields: cancelFields } = cancelDetailSeries;

	let id = $derived(page.params.id!);
	let series = $derived(await getSeries(id));
	let history = $derived(await getSeriesHistory(id));

	let isActive = $derived(!series.cancelledAt);

</script>

<PageHeader title="Recurring Series" backHref="/staff/recurring">
	{#if isActive}
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
			<dd>{formatTimeRange(series.prototypeStartsAt, series.prototypeEndsAt)}</dd>

			<dt class="opacity-60">Booker</dt>
			<dd>{series.prototypeBookerType}: {series.prototypeBookerId}</dd>

			{#if series.prototypeNotes}
				<dt class="opacity-60">Notes</dt>
				<dd>{series.prototypeNotes}</dd>
			{/if}

			<dt class="opacity-60">Created</dt>
			<dd>{formatDate(series.createdAt)}</dd>

			{#if series.cancelledAt}
				<dt class="opacity-60">Cancelled</dt>
				<dd>{formatDate(series.cancelledAt)}</dd>
			{/if}
		</dl>
	</InfoCard>


	<!-- History -->
	{#if history.length > 1}
		<InfoCard title="Supersession History">
			<div class="space-y-2">
				{#each history as h, i}
					<div class="flex items-center gap-3 text-sm" class:opacity-50={i > 0}>
						<span class="font-mono text-xs">{h.id.slice(0, 8)}</span>
						<span class="font-mono text-xs flex-1">{h.rrule}</span>
						<span>{formatDate(h.createdAt)}</span>
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
