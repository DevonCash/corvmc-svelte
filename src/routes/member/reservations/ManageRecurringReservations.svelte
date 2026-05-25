<script lang="ts">
	import Button from '$lib/components/shared/Button.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import { CancelSeriesAction } from '$lib/components/shared/actions';
	import { getLocalUser } from '$lib/remote/users.remote';
	import { getRecurringReservations } from '$lib/remote/reservations.remote';
	import { editMemberSeries } from '$lib/remote/recurring.remote';
	import { format, formatDistanceStrict } from 'date-fns';
	import { IconPencil } from '@tabler/icons-svelte';
</script>

{#if !(await getLocalUser()).subscription}
	<div class="rounded-lg border border-base-300 px-4 pb-3 text-sm">
		<h2 class="pt-4 text-lg font-semibold">Recurring Reservations</h2>

		<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
			<span>Sustaining members can set up recurring weekly, biweekly, or monthly reservations.</span
			>
			<Button href="/member/membership" class="self-end btn-sm sm:self-auto">Learn More</Button>
		</div>
	</div>
{:else}
	<div class="flex items-center justify-between pt-4">
		<h2 class="text-lg font-semibold">My Recurring Reservations</h2>
	</div>

	{#each await getRecurringReservations() as series (series.id)}
		<div
			class="flex items-center justify-between rounded-md border-[2.5px] border-(--cmc-brown) bg-base-100 px-4 py-3"
		>
			<div class="min-w-0">
				<p class="font-medium">
					{series.frequencyLabel} · {format(series.startsAt, 'EEEE')}s
				</p>
				<p class="text-sm opacity-70">
					{format(series.startsAt, 'p')} – {format(series.endsAt, 'p')} · {formatDistanceStrict(
						series.endsAt,
						series.startsAt,
						{ unit: 'minute' }
					)}
				</p>
				{#if series.seriesEndsAt}
					<p class="text-xs opacity-50">Ends {format(series.seriesEndsAt, 'PP')}</p>
				{/if}
			</div>
			<div class="flex shrink-0 items-center gap-1">
				<Action
					action={editMemberSeries}
					label="Edit"
					modalTitle="Edit Schedule"
					successToast="Series schedule updated"
					onsuccess={() => getRecurringReservations().refresh()}
					class="btn-ghost btn-sm btn-square"
				>
					{#snippet trigger({ onclick, disabled })}
						<Button class="btn-ghost btn-sm btn-square" {disabled} onclick={onclick}>
							<IconPencil size={18} />
						</Button>
					{/snippet}
					{#snippet form({ close })}
						<input type="hidden" name="seriesId" value={series.id} />
						<div class="grid grid-cols-3 gap-3">
							<FormField
								name="date"
								label="Day"
								type="date"
								value={format(series.startsAt, 'yyyy-MM-dd')}
							/>
							<FormField
								name="startTime"
								label="Start"
								type="time"
								value={format(series.startsAt, 'HH:mm')}
							/>
							<FormField
								name="endTime"
								label="End"
								type="time"
								value={format(series.endsAt, 'HH:mm')}
							/>
						</div>
						<FormField name="frequency" label="Frequency">
							<select class="select-bordered select w-full" name="frequency">
								<option value="weekly" selected={series.frequencyLabel === 'Weekly'}>Weekly</option>
								<option value="biweekly" selected={series.frequencyLabel === 'Every 2 weeks'}
									>Every 2 weeks</option
								>
								<option value="monthly" selected={series.frequencyLabel === 'Monthly'}
									>Monthly</option
								>
							</select>
						</FormField>
						<p class="text-xs opacity-60">
							This will create a new series with the updated schedule. The current series will end.
						</p>
					{/snippet}
				</Action>
				<CancelSeriesAction
					seriesId={series.id}
					class="btn-ghost btn-sm btn-square"
					onsuccess={() => getRecurringReservations().refresh()}
				/>
			</div>
		</div>
	{:else}
		<p class="text-sm opacity-60">No active recurring reservations.</p>
	{/each}
{/if}
