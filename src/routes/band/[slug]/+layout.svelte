<script lang="ts">
	import type { LayoutData } from './$types';
	import { Toaster } from 'svelte-sonner';
	import {
		IconLayoutDashboard,
		IconUsersGroup,
		IconCalendar,
		IconPencil,
		IconSettings,
		IconUser
	} from '@tabler/icons-svelte';
	import Sidebar from '$lib/components/shared/Sidebar.svelte';
	import Topbar from '$lib/components/shared/Topbar.svelte';
	import UserFooter from '$lib/components/shared/UserFooter.svelte';

	let { data, children }: { data: LayoutData; children: any } = $props();

	const base = $derived(`/band/${data.band.slug}`);
	const isOwnerOrAdmin = $derived(
		data.userRole === 'owner' || data.userRole === 'admin'
	);

	const navItems = $derived([
		{ href: base, label: 'Dashboard', icon: IconLayoutDashboard },
		{ href: `${base}/members`, label: 'Members', icon: IconUsersGroup },
		{ href: `${base}/reservations`, label: 'Reservations', icon: IconCalendar },
		...(isOwnerOrAdmin
			? [
					{ href: `${base}/edit`, label: 'Edit Band', icon: IconPencil },
					{ href: `${base}/profile`, label: 'Profile', icon: IconUser }
				]
			: []),
		...(data.userRole === 'owner'
			? [{ href: `${base}/settings`, label: 'Settings', icon: IconSettings }]
			: [])
	]);
</script>

<Toaster position="bottom-right" richColors closeButton />

<div class="drawer lg:drawer-open">
	<input id="band-drawer" type="checkbox" class="drawer-toggle" />

	<div class="drawer-content flex flex-col">
		<Topbar drawerId="band-drawer" userName={data.user?.name ?? ''} title={data.band.name} />

		<main class="flex-1 p-6">
			{@render children()}
		</main>
	</div>

	<div class="drawer-side z-40">
		<label for="band-drawer" class="drawer-overlay"></label>
		<Sidebar {navItems} title={data.band.name} badge="Band">
			{#snippet footer()}
				<div class="border-t border-base-300 p-4">
					<a href="/member/bands" class="btn btn-ghost btn-sm btn-block justify-start">
						← Back to My Bands
					</a>
				</div>
			{/snippet}
		</Sidebar>
	</div>
</div>
