<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Pagination from '$lib/components/shared/Pagination.svelte';
	import MemberLink from '$lib/components/shared/MemberLink.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import { IconRepeat } from '@tabler/icons-svelte';
	import {
		formatTimeRange,
		formatDuration,
		formatScheduleLabel,
		formatMonthDayYear,
		formatDate
	} from '$lib/utils/format';
	import { cancelStaffSeries, getStaffRecurring } from '$lib/remote/recurring.remote';
	const { fields: cancelFields } = cancelStaffSeries;

	let filter = $state<'active' | 'cancelled' | 'all'>('active');
	let page = $state(1);

	let filters = $derived({ filter, page });
	let result = $derived(getStaffRecurring(filters));
</script>

<PageHeader title="Recurring Reservations" />
<PageContent>
	<div class="flex items-center gap-2 mb-4">
		<button
			class="btn btn-sm"
			class:btn-primary={filter === 'active'}
			class:btn-ghost={filter !== 'active'}
			onclick={() => {
				filter = 'active';
				page = 1;
			}}
		>
			Active
		</button>
		<button
			class="btn btn-sm"
			class:btn-primary={filter === 'cancelled'}
			class:btn-ghost={filter !== 'cancelled'}
			onclick={() => {
				filter = 'cancelled';
				page = 1;
			}}
		>
			Cancelled
		</button>
		<button
			class="btn btn-sm"
			class:btn-primary={filter === 'all'}
			class:btn-ghost={filter !== 'all'}
			onclick={() => {
				filter = 'all';
				page = 1;
			}}
		>
			All
		</button>
	</div>

	{#await result}
		<div class="flex justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:then { rows: series, pagination }}
		{#if series.length === 0}
			<p class="text-center opacity-60 py-8">No recurring series found</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th>Member</th>
							<th>Schedule</th>
							<th class="w-px">Starts</th>
							<th class="w-px">Created</th>
							<th class="w-px">Status</th>
							<th class="w-px"></th>
						</tr>
					</thead>
					<tbody>
						{#each series as s (s.id)}
							<tr
								class="hover cursor-pointer"
								onclick={() => (window.location.href = `/staff/recurring/${s.id}`)}
							>
								<td onclick={(e) => e.stopPropagation()}>
									<MemberLink
										member={{ name: s.userName, pronouns: s.userPronouns, role: s.userRole }}
									/>
								</td>
								<td>
									<div class="flex items-center gap-1">
										<IconRepeat size={14} class="opacity-60 shrink-0" />
										{formatScheduleLabel(s.frequencyLabel, s.startsAt)}
									</div>
									<div class="text-sm opacity-60">
										{formatTimeRange(s.startsAt, s.endsAt)}
										<span class="mx-1">·</span>
										{formatDuration(s.startsAt, s.endsAt)}
									</div>
								</td>
								<td class="w-px">{formatMonthDayYear(s.startsAt)}</td>
								<td class="w-px">{formatDate(s.createdAt)}</td>
								<td class="w-px">
									{#if s.cancelledAt}
										<StatusBadge status="cancelled" />
									{:else}
										<StatusBadge status="active" />
									{/if}
								</td>
								<td class="w-px" onclick={(e) => e.stopPropagation()}>
									{#if !s.cancelledAt}
										<Action
											action={cancelStaffSeries}
											label="Cancel"
											modalTitle="Confirm"
											successToast="Series cancelled"
											onsuccess={() => {
												void getStaffRecurring(filters).refresh();
											}}
											class="btn-ghost btn-xs text-error"
										>
											{#snippet form()}
												<input {...cancelFields.seriesId.as('hidden', s.id)} />
												<p class="py-4">
													Cancel this recurring series? Future reservations will not be created.
												</p>
											{/snippet}
										</Action>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<Pagination
				page={pagination.page}
				totalPages={pagination.totalPages}
				onpage={(p) => (page = p)}
			/>
		{/if}
	{/await}
</PageContent>
