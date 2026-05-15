<script lang="ts">
	import type { LayoutServerData } from './$types';
	import { Toaster } from 'svelte-sonner';
	import Sidebar from '$lib/components/shared/Sidebar.svelte';
	import Topbar from '$lib/components/shared/Topbar.svelte';
	import UserFooter from '$lib/components/shared/UserFooter.svelte';
	import NotificationBell from '$lib/components/shared/NotificationBell.svelte';
	import {
		IconHome,
		IconUsers,
		IconClipboardCheck,
		IconCalendarEvent,
		IconBan,
		IconSettings,
		IconCash,
		IconRepeat
	} from '@tabler/icons-svelte';

	let { data, children }: { data: LayoutServerData; children: any } = $props();

	const navItems = [
		{ href: '/staff', label: 'Dashboard', icon: IconHome },
		{ href: '/staff/users', label: 'Users', icon: IconUsers },
		{ href: '/staff/reservations', label: 'Reservations', icon: IconClipboardCheck },
		{ href: '/staff/recurring', label: 'Recurring', icon: IconRepeat },
		{ href: '/staff/events', label: 'Events', icon: IconCalendarEvent },
		{ href: '/staff/payments', label: 'Payments', icon: IconCash },
		{ href: '/staff/closures', label: 'Closures', icon: IconBan },
		{ href: '/staff/settings', label: 'Settings', icon: IconSettings },
	];
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
		<Sidebar {navItems}>
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
			{/snippet}
			{#snippet footer()}
				<UserFooter name={data.user.name} email={data.user.email} />
			{/snippet}
		</Sidebar>
	</div>
</div>
