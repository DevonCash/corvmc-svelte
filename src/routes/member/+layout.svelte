<script lang="ts">
	import type { LayoutServerData } from './$types';
	import { Toaster } from 'svelte-sonner';
	import { IconLayoutDashboard, IconStar, IconCalendar, IconSettings } from '@tabler/icons-svelte';
	import Sidebar from '$lib/components/staff/Sidebar.svelte';
	import Topbar from '$lib/components/staff/Topbar.svelte';
	import UserFooter from '$lib/components/staff/UserFooter.svelte';

	let { data, children }: { data: LayoutServerData; children: any } = $props();

	const navItems = [
		{ href: '/member', label: 'Dashboard', icon: IconLayoutDashboard },
		{ href: '/member/membership', label: 'Membership', icon: IconStar },
		{ href: '/member/reservations', label: 'Reservations', icon: IconCalendar },
		{ href: '/member/account', label: 'Account', icon: IconSettings },
	];
</script>

<Toaster position="bottom-right" richColors closeButton />

<div class="drawer lg:drawer-open">
	<input id="member-drawer" type="checkbox" class="drawer-toggle" />

	<div class="drawer-content flex flex-col">
		<Topbar drawerId="member-drawer" userName={data.user.name} />

		<main class="flex-1 p-6">
			{@render children()}
		</main>
	</div>

	<div class="drawer-side z-40">
		<label for="member-drawer" class="drawer-overlay"></label>
		<Sidebar {navItems}>
			{#snippet footer()}
				<UserFooter name={data.user.name} email={data.user.email} />
			{/snippet}
		</Sidebar>
	</div>
</div>
