<script lang="ts">
	import type { LayoutServerData } from './$types';
	import { Toaster } from 'svelte-sonner';
	import {
		IconLayoutDashboard,
		IconStar,
		IconCalendar,
		IconSettings,
		IconUsersGroup,
		IconAddressBook,
		IconTicket
	} from '@tabler/icons-svelte';
	import Sidebar from '$lib/components/shared/Sidebar.svelte';
	import Topbar from '$lib/components/shared/Topbar.svelte';
	import UserFooter from '$lib/components/shared/UserFooter.svelte';
	import NavItem from '$lib/components/shared/NavItem.svelte';
	import NavGroup from '$lib/components/shared/NavGroup.svelte';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import NotificationBell from '$lib/components/shared/NotificationBell.svelte';

	let { data, children }: { data: LayoutServerData; children: any } = $props();
</script>

<Toaster position="bottom-right" richColors closeButton />

<div class="drawer lg:drawer-open">
	<input id="member-drawer" type="checkbox" class="drawer-toggle" />

	<div class="drawer-content flex flex-col">
		<Topbar drawerId="member-drawer" userName={data.user.name} showNotifications />

		<main class="flex-1 p-6">
			{@render children()}
		</main>
	</div>

	<div class="drawer-side z-40">
		<label for="member-drawer" class="drawer-overlay"></label>
		<Sidebar>
			{#snippet brand()}
				<div class="flex items-center justify-between px-6 py-5">
					<div class="flex items-center gap-2">
						<span class="truncate text-xl font-bold">CorvMC</span>
					</div>
					<div class="hidden lg:block">
						<NotificationBell />
					</div>
				</div>
			{/snippet}
			{#snippet navigation()}
				<NavItem href="/member" label="Dashboard">
					{#snippet icon()}<IconLayoutDashboard />{/snippet}
				</NavItem>
				<NavItem href="/member/reservations" label="Reservations">
					{#snippet icon()}<IconCalendar />{/snippet}
				</NavItem>
				<NavItem href="/member/tickets" label="My Tickets">
					{#snippet icon()}<IconTicket />{/snippet}
				</NavItem>
				<NavItem href="/member/directory" label="Directory">
					{#snippet icon()}<IconAddressBook />{/snippet}
				</NavItem>

				<NavGroup title="My Bands">
					{#each data.userBands as band}
						<NavItem href={`/member/bands/${band.id}`} label={band.name}>
							{#snippet icon()}
								<Avatar
									class="size-8"
									src={band.avatarKey ? `/api/bands/${band.id}/avatar` : undefined}
									name={band.name}
								/>
							{/snippet}
						</NavItem>
					{/each}
				</NavGroup>

				<div class="flex grow"></div>

				<NavItem href="/member/membership" label="Membership">
					{#snippet icon()}<IconStar />{/snippet}
				</NavItem>
				<NavItem href="/member/account" label="Account">
					{#snippet icon()}<IconSettings />{/snippet}
				</NavItem>
			{/snippet}
			{#snippet footer()}
				<UserFooter name={data.user.name} email={data.user.email} />
			{/snippet}
		</Sidebar>
	</div>
</div>
