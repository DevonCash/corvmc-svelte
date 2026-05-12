<script lang="ts">
	import type { PageServerData } from './$types';
	import DataTable from '$lib/components/DataTable.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Pagination from '$lib/components/Pagination.svelte';

	let { data }: { data: PageServerData } = $props();

	function buildHref(p: number): string {
		const params = new URLSearchParams();
		params.set('page', String(p));
		if (data.search) params.set('q', data.search);
		return `?${params}`;
	}
</script>

<div class="space-y-6">
	<PageHeader title="Users">
		<span class="text-sm opacity-60">{data.pagination.total} total</span>
	</PageHeader>

	<!-- Search -->
	<form method="get" class="flex gap-2">
		<input
			type="text"
			name="q"
			value={data.search}
			placeholder="Search by name or email..."
			class="input input-bordered w-full max-w-sm"
		/>
		<button type="submit" class="btn btn-primary">Search</button>
		{#if data.search}
			<a href="/staff/users" class="btn btn-ghost">Clear</a>
		{/if}
	</form>

	<DataTable items={data.users} empty="No users found">
		{#snippet header()}
			<tr>
				<th>Name</th>
				<th>Email</th>
				<th>Pronouns</th>
				<th>Roles</th>
				<th>Joined</th>
			</tr>
		{/snippet}
		{#snippet row(u)}
			<tr class="hover">
				<td>
					<a href="/staff/users/{u.id}" class="link link-primary">
						{u.name}
					</a>
				</td>
				<td>{u.email}</td>
				<td class="opacity-70">{u.pronouns ?? '—'}</td>
				<td class="space-x-1">
					{#each u.roles as r (r)}
						<span class="badge badge-outline badge-sm">{r}</span>
					{:else}
						<span class="opacity-40">none</span>
					{/each}
				</td>
				<td>{new Date(u.createdAt).toLocaleDateString()}</td>
			</tr>
		{/snippet}
	</DataTable>

	<Pagination
		page={data.pagination.page}
		totalPages={data.pagination.totalPages}
		{buildHref}
	/>
</div>
