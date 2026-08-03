<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import DataList from '$lib/components/shared/DataList.svelte';
	import Table from '$lib/components/shared/Table.svelte';
	import MemberLink from '$lib/components/shared/MemberLink.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import { rowLink } from '$lib/actions/row-link';
	import { resolve } from '$app/paths';
	import { IconRepeat, IconX } from '@tabler/icons-svelte';
	import {
		formatTimeRange,
		formatDuration,
		formatScheduleLabel,
		formatDateShortYear
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

	<DataList {result} empty="No recurring series found" onpage={(p) => (page = p)}>
		{#snippet children(series)}
			<Table>
				{#snippet head()}
					<th class="w-px"><span class="sr-only">Status</span></th>
					<th>Series</th>
					<th class="col-support whitespace-nowrap">Starts</th>
					<th class="w-px"><span class="sr-only">Actions</span></th>
				{/snippet}

				{#each series as s (s.id)}
					{@const href = resolve(`/staff/recurring/${s.id}`)}
					<tr class="hover cursor-pointer" use:rowLink={href}>
						<td class="w-px">
							<StatusBadge status={s.cancelledAt ? 'cancelled' : 'active'} />
						</td>
						<!-- Schedule is the identity of a series; the member and the time
						     range are its qualifiers. Created dropped to the detail page. -->
						<td class="cell-primary">
							<a {href} class="flex min-w-0 items-center gap-1 font-medium hover:underline">
								<IconRepeat size={14} class="shrink-0 opacity-60" />
								<span class="truncate">
									{formatScheduleLabel(s.frequencyLabel, s.startsAt, s.monthlyMode)}
								</span>
							</a>
							<div class="flex min-w-0 items-center gap-1 text-sm opacity-60">
								<MemberLink
									variant="inline"
									member={{ name: s.userName, pronouns: s.userPronouns, role: s.userRole }}
								/>
								<span>·</span>
								<span class="whitespace-nowrap">
									{formatTimeRange(s.startsAt, s.endsAt)} · {formatDuration(s.startsAt, s.endsAt)}
								</span>
							</div>
						</td>
						<td class="col-support whitespace-nowrap">{formatDateShortYear(s.startsAt)}</td>
						<td class="w-px">
							{#if !s.cancelledAt}
								<Action
									action={cancelStaffSeries}
									label="Cancel series"
									iconOnly
									modalTitle="Confirm"
									successToast="Series cancelled"
									onsuccess={() => {
										void getStaffRecurring(filters).refresh();
									}}
									class="btn-ghost btn-sm btn-square text-error"
								>
									{#snippet icon()}<IconX size={16} />{/snippet}
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
			</Table>
		{/snippet}
	</DataList>
</PageContent>
