<script lang="ts">
	import ErrorToastBoundary from '$lib/components/shared/ErrorToastBoundary.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import AppShell from '$lib/components/shared/AppShell.svelte';
	import Nav from '$lib/components/shared/Nav';
	import {
		IconUsers,
		IconClipboardCheck,
		IconCalendarEvent,
		IconBan,
		IconSettings,
		IconCash,
		IconCoins,
		IconRepeat,
		IconMusic,
		IconMail,
		IconMailbox,
		IconTool,
		IconPackage,
		IconBook,
		IconLayoutDashboard,
		IconInbox,
		IconFlag
	} from '@tabler/icons-svelte';
	import { getStaffLayout } from '$lib/remote/layout.remote';

	let { children } = $props();

	let layout = $derived(await getStaffLayout());

	const panels = $derived([
		{ key: 'member', label: 'Member', href: '/member', type: 'member' as const },
		{ key: 'staff', label: 'Staff', href: '/staff', type: 'staff' as const },
		...layout.userBands.map((b) => ({
			key: b.slug,
			label: b.name,
			href: `/band/${b.slug}`,
			type: 'band' as const
		}))
	]);
</script>

<AppShell drawerId="staff-drawer" user={layout.user} {panels} activePanel="staff">
	{#snippet brand()}
		<div class="flex items-center gap-2 px-6 py-5">
			<span class="truncate text-xl font-bold">CorvMC</span>
			<Badge variant="primary">Staff</Badge>
		</div>
	{/snippet}
	{#snippet navigation()}
		<Nav.Item href="/staff" label="Dashboard">
			{#snippet icon()}<IconLayoutDashboard />{/snippet}
		</Nav.Item>
		{#if layout.features.staffInbox}
			<Nav.Item href="/staff/inbox" label="Inbox">
				{#snippet icon()}<IconInbox />{/snippet}
			</Nav.Item>
		{/if}

		<Nav.Group title="Operations">
			<Nav.Item href="/staff/users" label="Users">
				{#snippet icon()}<IconUsers />{/snippet}
			</Nav.Item>
			<Nav.Collapsible
				href="/staff/reservations"
				label="Reservations"
				childHrefs={['/staff/reservations', '/staff/recurring', '/staff/closures']}
			>
				{#snippet icon()}<IconClipboardCheck />{/snippet}
				<Nav.Item href="/staff/recurring" label="Recurring">
					{#snippet icon()}<IconRepeat />{/snippet}
				</Nav.Item>
				<Nav.Item href="/staff/closures" label="Closures">
					{#snippet icon()}<IconBan />{/snippet}
				</Nav.Item>
			</Nav.Collapsible>
			<Nav.Item href="/staff/events" label="Events">
				{#snippet icon()}<IconCalendarEvent />{/snippet}
			</Nav.Item>
			<Nav.Item href="/staff/bands" label="Bands">
				{#snippet icon()}<IconMusic />{/snippet}
			</Nav.Item>
			{#if layout.features.contentFlags}
				<Nav.Item href="/staff/flags" label="Content Flags">
					{#snippet icon()}<IconFlag />{/snippet}
				</Nav.Item>
			{/if}
			{#if layout.features.equipment}
				<Nav.Collapsible
					href="/staff/equipment/loans"
					label="Equipment"
					childHrefs={['/staff/equipment/loans', '/staff/equipment']}
				>
					{#snippet icon()}<IconTool />{/snippet}
					<Nav.Item href="/staff/equipment" label="Inventory">
						{#snippet icon()}<IconPackage />{/snippet}
					</Nav.Item>
				</Nav.Collapsible>
			{/if}
		</Nav.Group>

		{#if layout.features.emailMarketing}
			<Nav.Group title="Marketing">
				<Nav.Item href="/staff/marketing/campaigns" label="Campaigns">
					{#snippet icon()}<IconMail />{/snippet}
				</Nav.Item>
				<Nav.Item href="/staff/marketing/audiences" label="Audiences">
					{#snippet icon()}<IconMailbox />{/snippet}
				</Nav.Item>
			</Nav.Group>
		{/if}

		{#if layout.features.helpArticles}
			<Nav.Group title="Content">
				<Nav.Item href="/staff/help" label="Help Articles">
					{#snippet icon()}<IconBook />{/snippet}
				</Nav.Item>
			</Nav.Group>
		{/if}

		<Nav.Group title="System">
			<Nav.Item href="/staff/payments" label="Payments">
				{#snippet icon()}<IconCash />{/snippet}
			</Nav.Item>
			<Nav.Item href="/staff/credits" label="Credits">
				{#snippet icon()}<IconCoins />{/snippet}
			</Nav.Item>
			<Nav.Item href="/staff/settings" label="Settings">
				{#snippet icon()}<IconSettings />{/snippet}
			</Nav.Item>
		</Nav.Group>
	{/snippet}
	<ErrorToastBoundary>
		{@render children()}
	</ErrorToastBoundary>
</AppShell>
