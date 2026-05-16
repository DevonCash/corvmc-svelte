<script lang="ts">
	import {
		IconLayoutDashboard,
		IconUsersGroup,
		IconCalendar,
		IconPencil,
		IconSettings,
		IconUser
	} from '@tabler/icons-svelte';
	import AppShell from '$lib/components/shared/AppShell.svelte';
	import NavItem from '$lib/components/shared/NavItem.svelte';

	let { data, children }: { data: any; children: any } = $props();

	const base = $derived(`/band/${data.band.slug}`);
	const isOwnerOrAdmin = $derived(data.userRole === 'owner' || data.userRole === 'admin');

	const panels = $derived([
		{ key: 'member', label: 'Member', href: '/member', type: 'member' as const },
		...(data.isStaff
			? [{ key: 'staff', label: 'Staff', href: '/staff', type: 'staff' as const }]
			: []),
		...data.userBands.map((b) => ({
			key: b.slug,
			label: b.name,
			href: `/band/${b.slug}`,
			type: 'band' as const
		}))
	]);
</script>

<AppShell
	drawerId="band-drawer"
	user={data.user}
	{panels}
	activePanel={data.band.slug}
>
	{#snippet brand()}
		<div class="flex items-center gap-2 px-6 py-5">
			<span class="truncate text-xl font-bold">{data.band.name}</span>
			<span class="badge badge-sm badge-primary">Band</span>
		</div>
	{/snippet}
	{#snippet navigation()}
		<NavItem href={base} label="Dashboard">
			{#snippet icon()}<IconLayoutDashboard size={20} />{/snippet}
		</NavItem>
		<NavItem href={`${base}/members`} label="Members">
			{#snippet icon()}<IconUsersGroup size={20} />{/snippet}
		</NavItem>
		<NavItem href={`${base}/reservations`} label="Reservations">
			{#snippet icon()}<IconCalendar size={20} />{/snippet}
		</NavItem>
		{#if isOwnerOrAdmin}
			<NavItem href={`${base}/edit`} label="Edit Band">
				{#snippet icon()}<IconPencil size={20} />{/snippet}
			</NavItem>
			<NavItem href={`${base}/profile`} label="Profile">
				{#snippet icon()}<IconUser size={20} />{/snippet}
			</NavItem>
		{/if}
		{#if data.userRole === 'owner'}
			<NavItem href={`${base}/settings`} label="Settings">
				{#snippet icon()}<IconSettings size={20} />{/snippet}
			</NavItem>
		{/if}
	{/snippet}
	{@render children()}
</AppShell>
