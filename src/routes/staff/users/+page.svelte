<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Pagination from '$lib/components/shared/Pagination.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import MemberLink from '$lib/components/shared/MemberLink.svelte';
	import { IconUserCog, IconUserShield, IconUserHeart, IconDots, IconEye, IconCopy, IconUserUp } from '@tabler/icons-svelte';
	import { getStaffUsers } from '$lib/remote/users.remote';
	import { formatDate } from '$lib/utils/format';

	let search = $state('');
	let page = $state(1);

	let searchDebounced = $state('');
	let searchTimer: ReturnType<typeof setTimeout>;
	function onSearchInput(e: Event) {
		search = (e.target as HTMLInputElement).value;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			searchDebounced = search;
			page = 1;
		}, 300);
	}

	let filters = $derived({
		search: searchDebounced || undefined,
		page
	});

	let result = $derived(getStaffUsers(filters));

	type User = Awaited<typeof result>['rows'][number];

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
	{#await result then { pagination }}
		<span class="text-sm opacity-60">{pagination.total} total</span>
	{/await}
</PageHeader>
<PageContent>
	<div class="flex flex-wrap items-end gap-2 mb-4">
		<input
			type="text"
			class="input input-bordered input-sm w-full max-w-sm"
			placeholder="Search by name or email..."
			value={search}
			oninput={onSearchInput}
		/>
	</div>

	{#await result}
		<div class="flex justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:then { rows: users, pagination }}
		{#if users.length === 0}
			<p class="text-center opacity-60 py-8">No users found</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th class="w-px"></th>
							<th>Member</th>
							<th>Email</th>
							<th>Joined</th>
							<th class="w-px"></th>
						</tr>
					</thead>
					<tbody>
						{#each users as row (row.id)}
							<tr class="hover cursor-pointer" onclick={() => window.location.href = `/staff/users/${row.id}`}>
								<td class="w-px">
									{#if getTier(row)}
										{@const tier = getTier(row)}
										<span class="tooltip tooltip-right" data-tip={tierLabel[tier!]}>
											{#if tier === 'admin'}
												<IconUserCog size={18} class="text-warning" />
											{:else if tier === 'staff'}
												<IconUserShield size={18} class="text-info" />
											{:else}
												<IconUserHeart size={18} class="text-error" />
											{/if}
										</span>
									{/if}
								</td>
								<td>
									<div>
										<span class="font-medium">{row.name}</span>
										{#if row.pronouns}
											<span class="block text-sm opacity-60">{row.pronouns}</span>
										{/if}
									</div>
								</td>
								<td>{row.email}</td>
								<td>{formatDate(row.createdAt)}</td>
								<td class="w-px" onclick={(e) => e.stopPropagation()}>
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
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<Pagination page={pagination.page} totalPages={pagination.totalPages} onpage={(p) => page = p} />
		{/if}
	{/await}
</PageContent>
