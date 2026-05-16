<script lang="ts">
	import type { Column } from '$lib/components/shared/Table/DataTable.svelte';
	import StatCard from '$lib/components/shared/StatCard.svelte';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';

	let { data }: { data: any } = $props();

	type RecentUser = (typeof data.recentUsers)[number];

	const columns: Column<RecentUser>[] = [
		{ key: 'name', header: 'Name', sortable: true },
		{ key: 'email', header: 'Email' },
		{
			key: 'createdAt',
			header: 'Joined',
			sortable: true,
			cell: (v) => new Date(v as string).toLocaleDateString()
		}
	];
</script>

<div class="space-y-6">
	<PageHeader title="Dashboard" />

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<StatCard title="Total Members" value={data.stats.totalUsers} />
		<StatCard title="Active Roles" value={data.stats.totalRoles} />
		<StatCard title="Permissions" value={data.stats.totalPermissions} />
		<StatCard title="New This Month" value={data.stats.newUsersThisMonth} />
	</div>

	<DataTable data={data.recentUsers} {columns} empty="No members yet">
		{#snippet row(u)}
			<tr>
				<td>
					<a href="/staff/users/{u.id}" class="link link-primary">{u.name}</a>
				</td>
				<td>{u.email}</td>
				<td>{new Date(u.createdAt).toLocaleDateString()}</td>
			</tr>
		{/snippet}
	</DataTable>
</div>
