<script lang="ts">
	import {
		IconLayoutDashboard,
		IconUsersGroup,
		IconCalendar,
		IconPencil,
		IconSettings,
		IconUser
	} from '@tabler/icons-svelte';
	import ErrorToastBoundary from '$lib/components/shared/ErrorToastBoundary.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import AppShell from '$lib/components/shared/AppShell.svelte';
	import Nav from '$lib/components/shared/Nav';
	import type { BandLayoutResponse } from '$lib/types/api';

	let { data, children }: { data: BandLayoutResponse; children: import('svelte').Snippet } = $props();

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
	user={data.user!}
	{panels}
	activePanel={data.band.slug}
>
	{#snippet brand()}
		<div class="flex items-center gap-2 px-6 py-5">
			<span class="truncate text-xl font-bold">{data.band.name}</span>
			<Badge variant="primary">Band</Badge>
		</div>
	{/snippet}
	{#snippet navigation()}
		<Nav.Item href={base} label="Dashboard">
			{#snippet icon()}<IconLayoutDashboard />{/snippet}
		</Nav.Item>
		<Nav.Item href={`${base}/members`} label="Members">
			{#snippet icon()}<IconUsersGroup />{/snippet}
		</Nav.Item>
		<Nav.Item href={`${base}/reservations`} label="Reservations">
			{#snippet icon()}<IconCalendar />{/snippet}
		</Nav.Item>
		{#if isOwnerOrAdmin}
			<Nav.Item href={`${base}/edit`} label="Edit Band">
				{#snippet icon()}<IconPencil />{/snippet}
			</Nav.Item>
			<Nav.Item href={`${base}/profile`} label="Profile">
				{#snippet icon()}<IconUser />{/snippet}
			</Nav.Item>
		{/if}
		{#if data.userRole === 'owner'}
			<Nav.Item href={`${base}/settings`} label="Settings">
				{#snippet icon()}<IconSettings />{/snippet}
			</Nav.Item>
		{/if}
	{/snippet}
	<ErrorToastBoundary>
		{@render children()}
	</ErrorToastBoundary>
</AppShell>
