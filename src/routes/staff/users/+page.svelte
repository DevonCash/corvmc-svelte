<script lang="ts">
	import { type Column, default as DataTable } from '$lib/components/shared/Table/DataTable.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import type { StaffUsersResponse } from '$lib/types/api';

	let { data }: { data: StaffUsersResponse } = $props();

	type User = (typeof data.users)[number];

	const columns: Column<User>[] = [
		{ key: 'name', header: 'Name', sortable: true },
		{ key: 'email', header: 'Email', sortable: true },
		{
			key: 'pronouns',
			header: 'Pronouns',
			cell: (v: unknown) => (v as string) ?? '—',
			class: 'opacity-70'
		},
		{ key: 'roles', header: 'Roles' },
		{
			key: 'createdAt',
			header: 'Joined',
			sortable: true,
			cell: (v: unknown) => new Date(v as string).toLocaleDateString()
		}
	];
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
			class="input-bordered input w-full max-w-sm"
		/>
		<button type="submit" class="btn btn-primary">Search</button>
		{#if data.search}
			<a href="/staff/users" class="btn btn-ghost">Clear</a>
		{/if}
	</form>

	<DataTable data={data.users} {columns} empty="No users found">
		{#snippet row(u: User)}
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
</div>
