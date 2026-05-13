<script lang="ts">
	import type { LayoutServerData } from './$types';
	import { Toaster } from 'svelte-sonner';
	import Sidebar from '$lib/components/staff/Sidebar.svelte';
	import Topbar from '$lib/components/staff/Topbar.svelte';
	import UserFooter from '$lib/components/staff/UserFooter.svelte';

	let { data, children }: { data: LayoutServerData; children: any } = $props();

	const navItems = [
		{ href: '/member/membership', label: 'Membership', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
		{ href: '/member/reservations', label: 'Reservations', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
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
