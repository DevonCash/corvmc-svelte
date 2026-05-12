<script lang="ts">
	import type { PageServerData } from './$types';
	import StatCard from '$lib/components/StatCard.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';

	let { data }: { data: PageServerData } = $props();
</script>

<div class="space-y-6">
	<PageHeader title="Dashboard" />

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<StatCard title="Total Members" value={data.stats.totalUsers} />
		<StatCard title="Active Roles" value={data.stats.totalRoles} />
		<StatCard title="Permissions" value={data.stats.totalPermissions} />
		<StatCard title="New This Month" value={data.stats.newUsersThisMonth} />
	</div>

	<DataTable items={data.recentUsers} empty="No members yet">
		{#snippet header()}
			<tr>
				<th>Name</th>
				<th>Email</th>
				<th>Joined</th>
			</tr>
		{/snippet}
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
