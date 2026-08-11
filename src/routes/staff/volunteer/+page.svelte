<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import DataList from '$lib/components/shared/DataList.svelte';
	import Table from '$lib/components/shared/Table.svelte';
	import FilterBar from '$lib/components/shared/FilterBar.svelte';
	import TabBar from '$lib/components/shared/TabBar.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import MemberLink from '$lib/components/shared/MemberLink.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import Select from '$lib/components/shared/Form/Select.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import { formatDateShort, relativeDay } from '$lib/utils/format';
	import { formatVolunteerHours, volunteerHourStatuses } from '$lib/config';
	import { IconCheck, IconX } from '@tabler/icons-svelte';
	import {
		getStaffVolunteerLogs,
		getVolunteerStatusCounts,
		getVolunteerRoles,
		approveVolunteerHours,
		rejectVolunteerHours
	} from '$lib/remote/volunteer.remote';

	type StatusView = (typeof volunteerHourStatuses)[number] | 'all';
	const statusViews: StatusView[] = [...volunteerHourStatuses, 'all'];

	// Filter state is seeded from the query string and mirrored back into it, so
	// a reload lands on the same view. Local state rather than reading `page.url`
	// back out, so a filter change re-renders immediately instead of waiting on
	// the navigation that mirrors it.
	const initial = page.url.searchParams;
	const parseStatus = (raw: string | null): StatusView =>
		statusViews.includes(raw as StatusView) ? (raw as StatusView) : 'pending';

	let statusView = $state(parseStatus(initial.get('status')));
	let roleFilter = $state(initial.get('role') ?? '');
	let fromDate = $state(initial.get('from') ?? '');
	let toDate = $state(initial.get('to') ?? '');
	// `searchText` (not `search`): FilterBar's always-visible slot is a snippet
	// named `search`, and a snippet shadows a same-named script binding.
	let searchText = $state(initial.get('q') ?? '');
	let searchQuery = $state(initial.get('q') ?? '');
	let pageNumber = $state(Number(initial.get('page') ?? '1') || 1);

	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	function onSearchInput(e: Event) {
		searchText = (e.target as HTMLInputElement).value;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			searchQuery = searchText;
			pageNumber = 1;
		}, 300);
	}

	$effect(() => () => clearTimeout(searchTimer));

	// Writes the URL, never state — the filters above stay the source of truth.
	// `goto(..., { replaceState })` rather than `replaceState()`: the latter only
	// rewrites the address bar, and the router overwrites that entry with its own
	// record on the next navigation.
	$effect(() => {
		// Pairs rather than URLSearchParams: the lint rule bans mutable instances
		// of it, and defaults are left out so a clean view has a clean URL.
		const pairs: [string, string][] = [];
		if (statusView !== 'pending') pairs.push(['status', statusView]);
		if (roleFilter) pairs.push(['role', roleFilter]);
		if (fromDate) pairs.push(['from', fromDate]);
		if (toDate) pairs.push(['to', toDate]);
		if (searchQuery) pairs.push(['q', searchQuery]);
		if (pageNumber > 1) pairs.push(['page', String(pageNumber)]);

		const search = pairs.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
		const href = `${resolve('/staff/volunteer')}${search ? `?${search}` : ''}`;
		if (location.pathname + location.search !== href) {
			void goto(href, { replaceState: true, noScroll: true, keepFocus: true });
		}
	});

	let filters = $derived({
		status: statusView === 'all' ? undefined : statusView,
		volunteerRoleId: roleFilter || undefined,
		from: fromDate || undefined,
		to: toDate || undefined,
		search: searchQuery || undefined,
		page: pageNumber
	});

	let result = $derived(getStaffVolunteerLogs(filters));
	let counts = $derived(getVolunteerStatusCounts());
	let roles = $derived(getVolunteerRoles());

	// The status view is a view, not a filter — it always has a value, so counting
	// it would leave "Clear" permanently offered.
	const activeFilterCount = $derived(
		(searchQuery ? 1 : 0) + (roleFilter ? 1 : 0) + (fromDate ? 1 : 0) + (toDate ? 1 : 0)
	);

	// A review has to refresh the list from HERE, not from the remote function:
	// `refresh()` is keyed by argument, and only this component knows the filter
	// object it subscribed with. Refreshing `getStaffVolunteerLogs({})` server-side
	// updated the tab counts but left the approved row sitting in the queue.
	function refreshQueue() {
		void getStaffVolunteerLogs(filters).refresh();
		void getVolunteerStatusCounts().refresh();
	}

	function clearFilters() {
		clearTimeout(searchTimer);
		searchText = '';
		searchQuery = '';
		roleFilter = '';
		fromDate = '';
		toDate = '';
		pageNumber = 1;
	}
</script>

<PageHeader title="Volunteering" subtitle="Staff">
	<Button href="/staff/volunteer/shifts" class="btn-ghost btn-sm">Shifts</Button>
	<Button href="/staff/volunteer/interest" class="btn-ghost btn-sm">Interest</Button>
	<Button href="/staff/volunteer/roles" class="btn-ghost btn-sm">Roles</Button>
	<Button href="/staff/volunteer/report" class="btn-ghost btn-sm">Report</Button>
</PageHeader>

<PageContent>
	{#await counts then c}
		<!-- Four tabs are wider than a phone; without this the last is clipped off
		     the edge with no way to reach it. -->
		<div class="mb-4 overflow-x-auto pb-1">
			<TabBar
				class="w-max"
				tabs={[
					{ key: 'pending', label: 'Pending', badge: c.pending },
					{ key: 'approved', label: 'Approved', badge: c.approved },
					{ key: 'rejected', label: 'Rejected', badge: c.rejected },
					{ key: 'all', label: 'All', badge: c.all }
				]}
				active={statusView}
				onchange={(key) => {
					statusView = key as StatusView;
					pageNumber = 1;
				}}
			/>
		</div>
	{/await}

	<FilterBar activeCount={activeFilterCount} onclear={clearFilters}>
		{#snippet search()}
			<input
				type="text"
				class="input input-bordered input-sm w-full"
				placeholder="Search members..."
				value={searchText}
				oninput={onSearchInput}
			/>
		{/snippet}

		{#await roles then roleOptions}
			<Select
				class="select-bordered select-sm"
				aria-label="Role"
				value={roleFilter}
				onchange={(e: Event) => {
					roleFilter = (e.currentTarget as HTMLSelectElement).value;
					pageNumber = 1;
				}}
			>
				<option value="">All roles</option>
				<!-- Archived roles stay listed: their logs are still in the table. -->
				{#each roleOptions as role (role.id)}
					<option value={role.id}>{role.name}{role.isActive ? '' : ' (archived)'}</option>
				{/each}
			</Select>
		{/await}

		<input
			type="date"
			class="input input-bordered input-sm"
			aria-label="Worked on or after"
			value={fromDate}
			onchange={(e) => {
				fromDate = (e.currentTarget as HTMLInputElement).value;
				pageNumber = 1;
			}}
		/>
		<input
			type="date"
			class="input input-bordered input-sm"
			aria-label="Worked on or before"
			value={toDate}
			onchange={(e) => {
				toDate = (e.currentTarget as HTMLInputElement).value;
				pageNumber = 1;
			}}
		/>
	</FilterBar>

	<DataList
		{result}
		empty={statusView === 'pending'
			? 'Nothing to review — the queue is clear.'
			: 'No hour logs found'}
		onpage={(p) => (pageNumber = p)}
	>
		{#snippet children(logs)}
			<Table>
				{#snippet head()}
					<th class="w-px"><span class="sr-only">Status</span></th>
					<th>Member</th>
					<th class="col-support">Role</th>
					<th class="col-support whitespace-nowrap">Worked</th>
					<th class="col-support cell-num">Hours</th>
					<th class="w-px"><span class="sr-only">Actions</span></th>
				{/snippet}

				{#each logs as log (log.id)}
					<tr class="hover">
						<td class="w-px">
							<StatusBadge status={log.status} />
							{#if log.shiftId}
								<!-- Filed against a shift staff scheduled — the person was
								     rostered, so this can be approved with less scrutiny. -->
								<span class="badge badge-ghost badge-xs mt-1" title="Logged from a scheduled shift"
									>scheduled</span
								>
							{/if}
						</td>

						<!--
							MemberLink already carries the email and the role glyph, so the
							description rides here as the subline rather than taking the
							seventh column the budget doesn't have.
						-->
						<td class="cell-primary">
							<MemberLink
								variant="inline"
								member={{
									name: log.userName,
									email: log.userEmail,
									pronouns: log.userPronouns,
									role: log.userRole,
									userId: log.userId
								}}
							/>
							<div class="truncate text-xs opacity-60" title={log.description}>
								{log.description}
							</div>
							{#if log.reviewNotes}
								<div class="truncate text-xs opacity-60">
									{log.reviewedByName ?? 'Staff'}: {log.reviewNotes}
								</div>
							{/if}
						</td>

						<td class="col-support">
							{log.roleName}{#if !log.roleIsActive}<span class="ml-1 text-xs opacity-50"
									>(archived)</span
								>{/if}
						</td>
						<td class="col-support whitespace-nowrap" title={relativeDay(log.createdAt)}>
							{formatDateShort(log.workedOn)}
						</td>
						<td class="col-support cell-num">{formatVolunteerHours(log.minutes)}</td>

						<td class="w-px">
							{#if log.status === 'pending'}
								<div class="flex justify-end gap-1">
									<Action
										action={approveVolunteerHours.for(log.id)}
										label="Approve"
										iconOnly
										icon={checkIcon}
										class="btn-ghost btn-sm text-success"
										modalTitle="Approve these hours?"
										submitLabel="Approve"
										successToast="Hours approved"
										onsuccess={refreshQueue}
									>
										{#snippet form()}
											<input type="hidden" name="id" value={log.id} />
											<p class="text-sm">
												{formatVolunteerHours(log.minutes)} of {log.roleName} by {log.userName} on
												{formatDateShort(log.workedOn)}.
											</p>
											<p class="text-sm opacity-70">{log.description}</p>
											<FormField
												name="notes"
												label="Note (optional)"
												type="textarea"
												description="Shared with the member."
											/>
										{/snippet}
									</Action>

									<Action
										action={rejectVolunteerHours.for(log.id)}
										label="Reject"
										iconOnly
										icon={xIcon}
										class="btn-ghost btn-sm text-error"
										modalTitle="Reject these hours?"
										submitLabel="Reject"
										submitClass="btn-error"
										successToast="Hours rejected"
										onsuccess={refreshQueue}
									>
										{#snippet form()}
											<input type="hidden" name="id" value={log.id} />
											<p class="text-sm">
												{formatVolunteerHours(log.minutes)} of {log.roleName} by {log.userName} on
												{formatDateShort(log.workedOn)}.
											</p>
											<p class="text-sm opacity-70">{log.description}</p>
											<FormField
												name="notes"
												label="Reason"
												type="textarea"
												description="Required — the member needs this to correct and resubmit."
											/>
										{/snippet}
									</Action>
								</div>
							{/if}
						</td>
					</tr>
				{/each}
			</Table>
		{/snippet}
	</DataList>
</PageContent>

{#snippet checkIcon()}
	<IconCheck size={16} />
{/snippet}

{#snippet xIcon()}
	<IconX size={16} />
{/snippet}
