<script lang="ts">
	import StatCard from '$lib/components/shared/StatCard.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import { getStaffDashboard } from '$lib/remote/users.remote';
	import { formatDate } from '$lib/utils/format';

	let data = $derived(await getStaffDashboard());
</script>

<PageHeader title="Dashboard" />
<PageContent>
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<StatCard title="Total Members" value={data.stats.totalUsers} />
		<StatCard title="Active Roles" value={data.stats.totalRoles} />
		<StatCard title="Permissions" value={data.stats.totalPermissions} />
		<StatCard title="New This Month" value={data.stats.newUsersThisMonth} />
	</div>

	{#if data.recentUsers.length === 0}
		<p class="text-center opacity-60 py-8">No members yet</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="table">
				<thead>
					<tr>
						<th>Name</th>
						<th>Email</th>
						<th>Joined</th>
					</tr>
				</thead>
				<tbody>
					{#each data.recentUsers as u (u.id)}
						<tr>
							<td>
								<a href="/staff/users/{u.id}" class="link link-primary">{u.name}</a>
							</td>
							<td>{u.email}</td>
							<td>{formatDate(u.createdAt)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</PageContent>
