<script lang="ts">
	import type { LayoutServerData } from './$types';
	import { Toaster } from 'svelte-sonner';
	import Sidebar from '$lib/components/shared/Sidebar.svelte';
	import Topbar from '$lib/components/shared/Topbar.svelte';
	import UserFooter from '$lib/components/shared/UserFooter.svelte';
	import NavItem from '$lib/components/shared/NavItem.svelte';
	import NavGroup from '$lib/components/shared/NavGroup.svelte';
	import NotificationBell from '$lib/components/shared/NotificationBell.svelte';
	import PanelSwitcher from '$lib/components/shared/PanelSwitcher.svelte';
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
		IconMailbox
	} from '@tabler/icons-svelte';

	let { data, children }: { data: LayoutServerData; children: any } = $props();
</script>

<Toaster position="bottom-right" richColors closeButton />

<div class="drawer lg:drawer-open">
	<input id="staff-drawer" type="checkbox" class="drawer-toggle" />

	<div class="drawer-content flex flex-col">
		<Topbar drawerId="staff-drawer" userName={data.user.name} showNotifications />

		<main class="flex-1 p-6">
			{@render children()}
		</main>
	</div>

	<div class="drawer-side z-40">
		<label for="staff-drawer" class="drawer-overlay"></label>
		<Sidebar navItems={null}>
			{#snippet brand()}
				<div class="flex items-center justify-between px-6 py-5">
					<div class="flex items-center gap-2">
						<span class="truncate text-xl font-bold">CorvMC</span>
						<span class="badge badge-sm badge-primary">Staff</span>
					</div>
					<div class="hidden lg:block">
						<NotificationBell />
					</div>
				</div>
				<PanelSwitcher current="staff" />
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
			{#snippet footer()}
				<UserFooter name={data.user.name} email={data.user.email} />
			{/snippet}
		</Sidebar>
	</div>
</div>
