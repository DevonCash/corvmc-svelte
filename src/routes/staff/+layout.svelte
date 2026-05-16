<script lang="ts">
	import Alert from '$lib/components/shared/Alert.svelte';
	import AppShell from '$lib/components/shared/AppShell.svelte';
	import NavItem from '$lib/components/shared/NavItem.svelte';
	import NavGroup from '$lib/components/shared/NavGroup.svelte';
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
		IconTool
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
		<NavItem href="/staff" label="Dashboard">
			{#snippet icon()}<IconHome size={20} />{/snippet}
		</NavItem>

		<NavGroup title="Operations">
			<NavItem href="/staff/users" label="Users">
				{#snippet icon()}<IconUsers size={20} />{/snippet}
			</NavItem>
			<NavItem href="/staff/reservations" label="Reservations">
				{#snippet icon()}<IconClipboardCheck size={20} />{/snippet}
			</NavItem>
			<NavItem href="/staff/events" label="Events">
				{#snippet icon()}<IconCalendarEvent size={20} />{/snippet}
			</NavItem>
			<NavItem href="/staff/bands" label="Bands">
				{#snippet icon()}<IconMusic size={20} />{/snippet}
			</NavItem>
			<NavItem href="/staff/closures" label="Closures">
				{#snippet icon()}<IconBan size={20} />{/snippet}
			</NavItem>
			<NavItem href="/staff/equipment" label="Equipment">
				{#snippet icon()}<IconTool size={20} />{/snippet}
			</NavItem>
		</NavGroup>

		<NavGroup title="Marketing">
			<NavItem href="/staff/marketing/campaigns" label="Campaigns">
				{#snippet icon()}<IconMail size={20} />{/snippet}
			</NavItem>
			<NavItem href="/staff/marketing/audiences" label="Audiences">
				{#snippet icon()}<IconMailbox size={20} />{/snippet}
			</NavItem>
		</NavGroup>

		<NavGroup title="System">
			<NavItem href="/staff/payments" label="Payments">
				{#snippet icon()}<IconCash size={20} />{/snippet}
			</NavItem>
			<NavItem href="/staff/recurring" label="Recurring">
				{#snippet icon()}<IconRepeat size={20} />{/snippet}
			</NavItem>
			<NavItem href="/staff/settings" label="Settings">
				{#snippet icon()}<IconSettings size={20} />{/snippet}
			</NavItem>
		</NavGroup>
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
