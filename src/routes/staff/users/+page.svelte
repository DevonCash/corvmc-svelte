<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Pagination from '$lib/components/shared/Pagination.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import Field from '$lib/components/shared/Form/FormField.svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';
	import { resolve } from '$app/paths';
	import {
		IconUserCog,
		IconUserShield,
		IconUserHeart,
		IconDots,
		IconEye,
		IconCopy,
		IconUserUp,
		IconUserOff
	} from '@tabler/icons-svelte';
	import { getStaffUsers, bulkDeactivateUsers } from '$lib/remote/users.remote';
	import { formatDate } from '$lib/utils/format';

	let search = $state('');
	let status = $state<'active' | 'deactivated' | 'all'>('active');
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
		status,
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

	const statusOptions = [
		{ value: 'active', label: 'Active' },
		{ value: 'deactivated', label: 'Deactivated' },
		{ value: 'all', label: 'All' }
	];

	// Selection (active users only — deactivated rows can't be deactivated again).
	let selected = new SvelteSet<string>();
	const { fields: bulkFields } = bulkDeactivateUsers;

	function toggle(id: string, checked: boolean) {
		if (checked) selected.add(id);
		else selected.delete(id);
	}

	function selectablePageIds(users: User[]): string[] {
		return users.filter((u) => !u.deletedAt).map((u) => u.id);
	}

	function toggleAll(users: User[], checked: boolean) {
		const ids = selectablePageIds(users);
		if (checked) ids.forEach((id) => selected.add(id));
		else ids.forEach((id) => selected.delete(id));
	}

	async function copyEmail(email: string) {
		await navigator.clipboard.writeText(email);
	}

	// `status` is updated by the select's own bind handler before this bubbling
	// change handler fires; reset paging + selection for the new filter.
	function onStatusChange() {
		page = 1;
		selected.clear();
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
		<div onchange={onStatusChange}>
			<Field type="select" label="" bind:value={status} options={statusOptions} class="w-40" />
		</div>
	</div>

	{#if selected.size > 0}
		<div class="flex items-center gap-3 mb-4 rounded-box bg-base-200 px-4 py-2">
			<span class="text-sm">{selected.size} selected</span>
			<Action
				action={bulkDeactivateUsers}
				label="Deactivate"
				class="btn-error btn-sm"
				modalTitle="Deactivate users"
				submitLabel="Deactivate"
				submitClass="btn-error"
				onsuccess={(result) => {
					const r = result as { deactivated: string[]; skipped: string[] };
					selected.clear();
					void getStaffUsers(filters).refresh();
					const skipped = r.skipped.length ? `, ${r.skipped.length} skipped` : '';
					toast.success(`${r.deactivated.length} deactivated${skipped}`);
				}}
			>
				{#snippet icon()}
					<IconUserOff size={16} />
				{/snippet}
				{#snippet form()}
					<input {...bulkFields.ids.as('hidden', JSON.stringify([...selected]))} />
					<p class="py-2">
						Deactivate {selected.size} selected user{selected.size === 1 ? '' : 's'}? Their future
						personal reservations will be cancelled.
					</p>
				{/snippet}
			</Action>
			<Button class="btn-ghost btn-sm" onclick={() => selected.clear()}>Clear</Button>
		</div>
	{/if}

	{#await result}
		<div class="flex justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:then { rows: users, pagination }}
		{#if users.length === 0}
			<p class="text-center opacity-60 py-8">No users found</p>
		{:else}
			{@const pageIds = selectablePageIds(users)}
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th class="w-px">
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									disabled={pageIds.length === 0}
									checked={pageIds.length > 0 && pageIds.every((id) => selected.has(id))}
									onchange={(e) => toggleAll(users, e.currentTarget.checked)}
								/>
							</th>
							<th class="w-px"></th>
							<th>Member</th>
							<th>Email</th>
							<th>Joined</th>
							<th class="w-px"></th>
						</tr>
					</thead>
					<tbody>
						{#each users as row (row.id)}
							<tr
								class="hover cursor-pointer"
								onclick={() => (window.location.href = `/staff/users/${row.id}`)}
							>
								<td class="w-px" onclick={(e) => e.stopPropagation()}>
									<input
										type="checkbox"
										class="checkbox checkbox-sm"
										disabled={!!row.deletedAt}
										checked={selected.has(row.id)}
										onchange={(e) => toggle(row.id, e.currentTarget.checked)}
									/>
								</td>
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
										{#if row.deletedAt}
											<Badge variant="error" size="xs" class="ml-2">Deactivated</Badge>
										{/if}
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
										<ul
											tabindex="0"
											class="dropdown-content menu bg-base-200 rounded-box z-10 w-44 p-2 shadow"
										>
											<li>
												<a href={resolve(`/staff/users/${row.id}`)}><IconEye size={16} />View</a>
											</li>
											<li>
												<button onclick={() => copyEmail(row.email)}
													><IconCopy size={16} />Copy email</button
												>
											</li>
											<li>
												<a href={resolve(`/staff/users/${row.id}/impersonate`)}
													><IconUserUp size={16} />Impersonate</a
												>
											</li>
										</ul>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<Pagination
				page={pagination.page}
				totalPages={pagination.totalPages}
				onpage={(p) => (page = p)}
			/>
		{/if}
	{/await}
</PageContent>
