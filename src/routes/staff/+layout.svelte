<script lang="ts">
	import Alert from '$lib/components/shared/Alert.svelte';
	import AppShell from '$lib/components/shared/AppShell.svelte';
	import Nav from '$lib/components/shared/Nav';
	import {
		IconHome,
		IconUsers,
		IconClipboardCheck,
		IconCalendarEvent,
		IconBan,
		IconSettings,
		IconCash,
		IconRepeat,
		IconMusic,
		IconMail,
		IconMailbox,
		IconTool,
		IconBook
	} from '@tabler/icons-svelte';
	import type { StaffLayoutResponse } from '$lib/types/api';

	let { data, children }: { data: StaffLayoutResponse; children: import('svelte').Snippet } = $props();

	const panels = $derived([
		{ key: 'member', label: 'Member', href: '/member', type: 'member' as const },
		{ key: 'staff', label: 'Staff', href: '/staff', type: 'staff' as const },
		...data.userBands.map((b) => ({
			key: b.slug,
			label: b.name,
			href: `/band/${b.slug}`,
			type: 'band' as const
		}))
	]);
</script>

<AppShell drawerId="staff-drawer" user={data.user} {panels} activePanel="staff">
	{#snippet brand()}
		<div class="flex items-center gap-2 px-6 py-5">
			<span class="truncate text-xl font-bold">CorvMC</span>
			<span class="badge badge-sm badge-primary">Staff</span>
		</div>
	{/snippet}
	{#snippet navigation()}
		<Nav.Item href="/staff" label="Dashboard">
			{#snippet icon()}<IconHome size={20} />{/snippet}
		</Nav.Item>

		<Nav.Group title="Operations">
			<Nav.Item href="/staff/users" label="Users">
				{#snippet icon()}<IconUsers size={20} />{/snippet}
			</Nav.Item>
			<Nav.Collapsible
				href="/staff/reservations"
				label="Reservations"
				childHrefs={['/staff/reservations', '/staff/recurring', '/staff/closures']}
			>
				{#snippet icon()}<IconClipboardCheck size={20} />{/snippet}
				{#snippet children()}
					<Nav.Item href="/staff/reservations" label="All Reservations">
						{#snippet icon()}<IconClipboardCheck size={20} />{/snippet}
					</Nav.Item>
					<Nav.Item href="/staff/recurring" label="Recurring">
						{#snippet icon()}<IconRepeat size={20} />{/snippet}
					</Nav.Item>
					<Nav.Item href="/staff/closures" label="Closures">
						{#snippet icon()}<IconBan size={20} />{/snippet}
					</Nav.Item>
				{/snippet}
			</Nav.Collapsible>
			<Nav.Item href="/staff/events" label="Events">
				{#snippet icon()}<IconCalendarEvent size={20} />{/snippet}
			</Nav.Item>
			<Nav.Item href="/staff/bands" label="Bands">
				{#snippet icon()}<IconMusic size={20} />{/snippet}
			</Nav.Item>
			<Nav.Item href="/staff/equipment" label="Equipment">
				{#snippet icon()}<IconTool size={20} />{/snippet}
			</Nav.Item>
		</Nav.Group>

		<Nav.Group title="Marketing">
			<Nav.Item href="/staff/marketing/campaigns" label="Campaigns">
				{#snippet icon()}<IconMail size={20} />{/snippet}
			</Nav.Item>
			<Nav.Item href="/staff/marketing/audiences" label="Audiences">
				{#snippet icon()}<IconMailbox size={20} />{/snippet}
			</Nav.Item>
		</Nav.Group>

		<Nav.Group title="Content">
			<Nav.Item href="/staff/help" label="Help Articles">
				{#snippet icon()}<IconBook size={20} />{/snippet}
			</Nav.Item>
		</Nav.Group>

		<Nav.Group title="System">
			<Nav.Item href="/staff/payments" label="Payments">
				{#snippet icon()}<IconCash size={20} />{/snippet}
			</Nav.Item>
			<Nav.Item href="/staff/settings" label="Settings">
				{#snippet icon()}<IconSettings size={20} />{/snippet}
			</Nav.Item>
		</Nav.Group>
	{/snippet}
	<svelte:boundary>
		{@render children()}

		{#snippet pending()}
			<div class="flex items-center justify-center p-12">
				<span class="loading loading-spinner loading-lg"></span>
			</div>
		{/snippet}

		{#snippet failed(error, reset)}
			<Alert type="error" {reset}>Failed to load: {String(error)}</Alert>
		{/snippet}
	</svelte:boundary>
</AppShell>
