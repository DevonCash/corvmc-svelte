<script lang="ts">
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import * as Filter from '$lib/components/shared/Table/Filter';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import { IconUserCog, IconUserShield, IconUserHeart, IconDots, IconEye, IconCopy, IconUserUp } from '@tabler/icons-svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type User = (typeof data.users)[number];

	function buildPageHref(page: number): string {
		const params = new URLSearchParams();
		if (data.search) params.set('q', data.search);
		params.set('page', String(page));
		return `/staff/users?${params.toString()}`;
	}

	function getTier(user: User): 'admin' | 'staff' | 'sustaining' | null {
		if (user.roles.includes('admin')) return 'admin';
		if (user.roles.includes('staff')) return 'staff';
		if (user.roles.includes('sustaining')) return 'sustaining';
		return null;
	}

	const tierLabel: Record<string, string> = {
		admin: 'Admin',
		staff: 'Staff',
		sustaining: 'Sustaining Member'
	};

	async function copyEmail(email: string) {
		await navigator.clipboard.writeText(email);
	}
</script>

<PageHeader title="Users">
		<span class="text-sm opacity-60">{data.pagination.total} total</span>
	</PageHeader>
<PageContent>
	<DataTable data={data.users} rowHref={(u) => `/staff/users/${u.id}`} clearHref="/staff/users" empty="No users found"
		pagination={{ page: data.pagination.page, totalPages: data.pagination.totalPages }} {buildPageHref}>
		{#snippet toolbar()}
			<Filter.Search name="q" value={data.search} placeholder="Search by name or email..." class="w-full max-w-sm" />
		{/snippet}
		<Column key="roles" header="" shrink>
			{#snippet cell(_, row)}
				{@const tier = getTier(row)}
				{#if tier}
					<span class="tooltip tooltip-right" data-tip={tierLabel[tier]}>
						{#if tier === 'admin'}
							<IconUserCog size={18} class="text-warning" />
						{:else if tier === 'staff'}
							<IconUserShield size={18} class="text-info" />
						{:else}
							<IconUserHeart size={18} class="text-error" />
						{/if}
					</span>
				{/if}
			{/snippet}
		</Column>
		<Column key="name" header="Member" sortable>
			{#snippet cell(_, row)}
				<div>
					<span class="font-medium">{row.name}</span>
					{#if row.pronouns}
						<span class="block text-sm opacity-60">{row.pronouns}</span>
					{/if}
				</div>
			{/snippet}
		</Column>
		<Column key="email" header="Email" sortable />
		<Column key="createdAt" header="Joined" sortable type="date" />
		<Column key="id" header="" shrink stopClick>
			{#snippet cell(_, row)}
				<div class="dropdown dropdown-end">
					<Button class="btn-ghost btn-xs btn-square" tabindex="0">
						<IconDots size={16} />
					</Button>
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<ul tabindex="0" class="dropdown-content menu bg-base-200 rounded-box z-10 w-44 p-2 shadow">
						<li><a href="/staff/users/{row.id}"><IconEye size={16} />View</a></li>
						<li><button onclick={() => copyEmail(row.email)}><IconCopy size={16} />Copy email</button></li>
						<li><a href="/staff/users/{row.id}/impersonate"><IconUserUp size={16} />Impersonate</a></li>
					</ul>
				</div>
			{/snippet}
		</Column>
	</DataTable>
</PageContent>
