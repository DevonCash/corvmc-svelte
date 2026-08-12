<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import DataList from '$lib/components/shared/DataList.svelte';
	import Table from '$lib/components/shared/Table.svelte';
	import FilterBar from '$lib/components/shared/FilterBar.svelte';
	import MemberLink from '$lib/components/shared/MemberLink.svelte';
	import Select from '$lib/components/shared/Form/Select.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import { formatDateShort } from '$lib/utils/format';
	import { volunteerRoleGroups, volunteerRoleGroupLabels } from '$lib/config';
	import { toast } from 'svelte-sonner';
	import {
		getInterestedVolunteers,
		getVolunteerInterestCounts
	} from '$lib/remote/volunteer.remote';

	// Same shape as the approval queue next door: local state is the source of
	// truth and the URL mirrors it, so a reload lands on the same view without the
	// filters waiting on a navigation to take effect.
	const initial = page.url.searchParams;

	let roleFilter = $state(initial.get('role') ?? '');
	// `searchText` rather than `search` — FilterBar's always-visible slot is a
	// snippet by that name, and a snippet shadows a same-named script binding.
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

	// `goto(..., { replaceState })`, not `replaceState()`: the latter only rewrites
	// the address bar and the router overwrites that entry on the next navigation.
	$effect(() => {
		const pairs: [string, string][] = [];
		if (roleFilter) pairs.push(['role', roleFilter]);
		if (searchQuery) pairs.push(['q', searchQuery]);
		if (pageNumber > 1) pairs.push(['page', String(pageNumber)]);

		const search = pairs.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
		const href = `${resolve('/staff/volunteer/interest')}${search ? `?${search}` : ''}`;
		if (location.pathname + location.search !== href) {
			void goto(href, { replaceState: true, noScroll: true, keepFocus: true });
		}
	});

	let filters = $derived({
		volunteerRoleId: roleFilter || undefined,
		search: searchQuery || undefined,
		page: pageNumber
	});

	let result = $derived(getInterestedVolunteers(filters));
	let counts = $derived(getVolunteerInterestCounts());

	const activeFilterCount = $derived((searchQuery ? 1 : 0) + (roleFilter ? 1 : 0));

	function clearFilters() {
		clearTimeout(searchTimer);
		searchText = '';
		searchQuery = '';
		roleFilter = '';
		pageNumber = 1;
	}

	// Until there's an in-app way to mail volunteers, the useful move is to hand
	// staff the addresses for whatever they've filtered to. Copies the page in
	// view, and says so, rather than implying it grabbed everyone.
	async function copyEmails(emails: string[]) {
		try {
			await navigator.clipboard.writeText(emails.join(', '));
			toast.success(`Copied ${emails.length} ${emails.length === 1 ? 'address' : 'addresses'}`);
		} catch {
			toast.error("Couldn't copy — your browser blocked clipboard access");
		}
	}
</script>

<PageHeader title="Volunteer Interest" subtitle="Staff" backHref="/staff/volunteer">
	{#await result then r}
		{#if r.rows.length > 0}
			<Button class="btn-ghost btn-sm" onclick={() => copyEmails(r.rows.map((m) => m.email))}>
				Copy emails on this page
			</Button>
		{/if}
	{/await}
</PageHeader>

<PageContent>
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

		{#await counts then roleCounts}
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
				<!-- Grouped, and carrying the count, so "nobody has signed up for
				     Tech" is visible without selecting it first. -->
				{#each volunteerRoleGroups as group (group)}
					{@const inGroup = roleCounts.filter((r) => r.group === group)}
					{#if inGroup.length > 0}
						<optgroup label={volunteerRoleGroupLabels[group]}>
							{#each inGroup as role (role.roleId)}
								<option value={role.roleId}>{role.roleName} ({role.interested})</option>
							{/each}
						</optgroup>
					{/if}
				{/each}
			</Select>
		{/await}
	</FilterBar>

	<DataList
		{result}
		empty={roleFilter
			? 'No one has picked this role yet.'
			: 'No one has said what they can help with yet.'}
		onpage={(p) => (pageNumber = p)}
	>
		{#snippet children(members)}
			<Table>
				{#snippet head()}
					<th>Member</th>
					<th class="col-support">Roles</th>
					<th class="col-extra whitespace-nowrap">Since</th>
				{/snippet}

				{#each members as member (member.userId)}
					<tr class="hover">
						<!--
							`cell-primary` (width:100%) rides on the roles cell, not this one:
							the badge list is what staff are reading here, and leaving the
							default on the member column squeezed the badges into a stack one
							word wide. The queue page next door makes the opposite call
							because there the description is the content.
						-->
						<td class="whitespace-nowrap">
							<MemberLink
								variant="inline"
								member={{
									name: member.name,
									email: member.email,
									pronouns: member.pronouns,
									role: member.role,
									userId: member.userId
								}}
							/>
						</td>

						<td class="col-support cell-primary">
							<div class="flex flex-wrap gap-1">
								{#each member.roleNames as roleName (roleName)}
									<span class="badge badge-ghost badge-sm">{roleName}</span>
								{/each}
							</div>
						</td>

						<td class="col-extra whitespace-nowrap">{formatDateShort(member.since)}</td>
					</tr>
				{/each}
			</Table>
		{/snippet}
	</DataList>
</PageContent>
