<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import DataList from '$lib/components/shared/DataList.svelte';
	import Table from '$lib/components/shared/Table.svelte';
	import FilterBar from '$lib/components/shared/FilterBar.svelte';
	import Select from '$lib/components/shared/Form/Select.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import { rowLink } from '$lib/actions/row-link';
	import { resolve } from '$app/paths';
	import { CreateBandAction } from '$lib/components/shared/actions';
	import { getStaffBands } from '$lib/remote/bands.remote';
	import { formatDateShortYear } from '$lib/utils/format';

	// `searchText`, not `search`: FilterBar's always-visible slot is a snippet
	// named `search`, and a snippet shadows a same-named script binding.
	let searchText = $state('');
	let status = $state<'active' | 'deactivated' | ''>('');
	let tier = $state<'free' | 'premium' | ''>('');
	let page = $state(1);

	let searchDebounced = $state('');
	let searchTimer: ReturnType<typeof setTimeout>;
	function onSearchInput(e: Event) {
		searchText = (e.target as HTMLInputElement).value;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			searchDebounced = searchText;
			page = 1;
		}, 300);
	}

	let filters = $derived({
		search: searchDebounced || undefined,
		status: status || undefined,
		tier: tier || undefined,
		page
	});

	let result = $derived(getStaffBands(filters));

	const activeFilterCount = $derived((searchDebounced ? 1 : 0) + (status ? 1 : 0) + (tier ? 1 : 0));

	function clearFilters() {
		searchText = '';
		searchDebounced = '';
		status = '';
		tier = '';
		page = 1;
	}
</script>

<PageHeader title="Bands">
	<CreateBandAction />
</PageHeader>
<PageContent>
	<FilterBar activeCount={activeFilterCount} onclear={clearFilters}>
		{#snippet search()}
			<input
				type="text"
				class="input input-bordered input-sm w-full"
				placeholder="Search by name..."
				value={searchText}
				oninput={onSearchInput}
			/>
		{/snippet}
		<Select
			class="select-bordered select-sm"
			aria-label="Status"
			value={status}
			onchange={(e: Event) => {
				status = (e.currentTarget as HTMLSelectElement).value as typeof status;
				page = 1;
			}}
		>
			<option value="">All statuses</option>
			<option value="active">Active</option>
			<option value="deactivated">Deactivated</option>
		</Select>
		<Select
			class="select-bordered select-sm"
			aria-label="Tier"
			value={tier}
			onchange={(e: Event) => {
				tier = (e.currentTarget as HTMLSelectElement).value as typeof tier;
				page = 1;
			}}
		>
			<option value="">All tiers</option>
			<option value="free">Free</option>
			<option value="premium">Premium</option>
		</Select>
	</FilterBar>

	<DataList {result} empty="No bands found" onpage={(p) => (page = p)}>
		{#snippet children(bands)}
			<Table>
				{#snippet head()}
					<th class="w-px"><span class="sr-only">Status</span></th>
					<th>Band</th>
					<th class="col-support">Tier</th>
					<th class="col-support cell-num">Members</th>
					<th class="col-extra whitespace-nowrap">Created</th>
				{/snippet}

				{#each bands as b (b.id)}
					{@const href = resolve(`/staff/bands/${b.id}`)}
					<tr class="hover cursor-pointer" use:rowLink={href}>
						<td class="w-px">
							<StatusBadge status={b.deletedAt ? 'deactivated' : 'active'} />
						</td>
						<!--
							Owner was its own column. As the subline it costs no width, and the
							row keeps a single link target (the band) for the primary line.
						-->
						<td class="cell-primary">
							<a {href} class="block truncate font-medium hover:underline">{b.name}</a>
							<div class="truncate text-muted">{b.ownerName}</div>
						</td>
						<td class="col-support"><StatusBadge status={b.tier} label /></td>
						<td class="col-support cell-num">{b.memberCount}</td>
						<td class="col-extra whitespace-nowrap">{formatDateShortYear(b.createdAt)}</td>
					</tr>
				{/each}
			</Table>
		{/snippet}
	</DataList>
</PageContent>
