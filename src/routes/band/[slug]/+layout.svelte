<script lang="ts">
	import {
		IconLayoutDashboard,
		IconUsersGroup,
		IconCalendar,
		IconCalendarEvent,
		IconPencil,
		IconSettings,
		IconUser,
		IconCrown,
		IconBrush
	} from '@tabler/icons-svelte';
	import ErrorToastBoundary from '$lib/components/shared/ErrorToastBoundary.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import AppShell from '$lib/components/shared/AppShell.svelte';
	import Nav from '$lib/components/shared/Nav';
	import { page } from '$app/state';
	import { getBandLayout } from '$lib/remote/layout.remote';

	let { children } = $props();

	let layout = $derived(await getBandLayout(page.params.slug!));

	const base = $derived(`/band/${layout.band.slug}`);
	const isOwnerOrAdmin = $derived(layout.userRole === 'owner' || layout.userRole === 'admin');

	const panels = $derived([
		{ key: 'member', label: 'Member', href: '/member', type: 'member' as const },
		...(layout.isStaff
			? [{ key: 'staff', label: 'Staff', href: '/staff', type: 'staff' as const }]
			: []),
		...layout.userBands.map((b) => ({
			key: b.slug,
			label: b.name,
			href: `/band/${b.slug}`,
			type: 'band' as const
		}))
	]);
</script>

<AppShell
	drawerId="band-drawer"
	user={layout.user}
	{panels}
	activePanel={layout.band.slug}
>
	{#snippet brand()}
		<div class="flex items-center gap-2 px-6 py-5">
			<span class="truncate text-xl font-bold">{layout.band.name}</span>
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
		<Nav.Item href={`${base}/events`} label="Events">
			{#snippet icon()}<IconCalendarEvent />{/snippet}
		</Nav.Item>
		{#if isOwnerOrAdmin}
			<Nav.Item href={`${base}/edit`} label="Edit Band">
				{#snippet icon()}<IconPencil />{/snippet}
			</Nav.Item>
			<Nav.Item href={`${base}/profile`} label="Profile">
				{#snippet icon()}<IconUser />{/snippet}
			</Nav.Item>
		{/if}
		{#if isOwnerOrAdmin && layout.band.tier === 'premium'}
			<Nav.Item href={`${base}/page-editor`} label="Page Editor">
				{#snippet icon()}<IconBrush />{/snippet}
			</Nav.Item>
		{/if}
		{#if layout.userRole === 'owner'}
			<Nav.Item href={`${base}/subscription`} label="Subscription">
				{#snippet icon()}<IconCrown />{/snippet}
			</Nav.Item>
			<Nav.Item href={`${base}/settings`} label="Settings">
				{#snippet icon()}<IconSettings />{/snippet}
			</Nav.Item>
		{/if}
	{/snippet}
	<ErrorToastBoundary>
		{@render children()}
	</ErrorToastBoundary>
</AppShell>
