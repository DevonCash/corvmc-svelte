<script lang="ts">
	import type { LayoutServerData } from './$types';
	import { Toaster } from 'svelte-sonner';
	import Sidebar from '$lib/components/staff/Sidebar.svelte';
	import Topbar from '$lib/components/staff/Topbar.svelte';
	import UserFooter from '$lib/components/staff/UserFooter.svelte';
	import {
		IconHome,
		IconUsers,
		IconClipboardCheck,
		IconCalendarEvent,
		IconBan,
		IconSettings
	} from '@tabler/icons-svelte';

	let { data, children }: { data: LayoutServerData; children: any } = $props();

	const navItems = [
		{ href: '/staff', label: 'Dashboard', icon: IconHome },
		{ href: '/staff/users', label: 'Users', icon: IconUsers },
		{ href: '/staff/reservations', label: 'Reservations', icon: IconClipboardCheck },
		{ href: '/staff/events', label: 'Events', icon: IconCalendarEvent },
		{ href: '/staff/closures', label: 'Closures', icon: IconBan },
		{ href: '/staff/settings', label: 'Settings', icon: IconSettings },
	];
</script>

<Toaster position="bottom-right" richColors closeButton />

<div class="drawer lg:drawer-open">
	<input id="staff-drawer" type="checkbox" class="drawer-toggle" />

	<div class="drawer-content flex flex-col">
		<Topbar drawerId="staff-drawer" userName={data.user.name} />

		<main class="flex-1 p-6">
			{@render children()}
		</main>
	</div>

	<div class="drawer-side z-40">
		<label for="staff-drawer" class="drawer-overlay"></label>
		<Sidebar {navItems}>
			{#snippet footer()}
				<UserFooter name={data.user.name} email={data.user.email} />
			{/snippet}
		</Sidebar>
	</div>
</div>
