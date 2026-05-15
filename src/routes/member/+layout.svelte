<script lang="ts">
	import type { LayoutServerData } from './$types';
	import {
		IconLayoutDashboard,
		IconStar,
		IconCalendar,
		IconTicket,
		IconAddressBook,
		IconTool
	} from '@tabler/icons-svelte';
	import AppShell from '$lib/components/shared/AppShell.svelte';
	import NavItem from '$lib/components/shared/NavItem.svelte';
	import NavGroup from '$lib/components/shared/NavGroup.svelte';
	import Avatar from '$lib/components/shared/Avatar.svelte';

	let { data, children }: { data: LayoutServerData; children: any } = $props();

	const panels = $derived([
		{ key: 'member', label: 'Member', href: '/member', type: 'member' as const },
		...(data.isStaff
			? [{ key: 'staff', label: 'Staff', href: '/staff', type: 'staff' as const }]
			: []),
		...data.userBands.map((b) => ({
			key: b.slug,
			label: b.name,
			href: `/band/${b.slug}`,
			type: 'band' as const
		}))
	]);
</script>

<AppShell drawerId="member-drawer" user={data.user} {panels} activePanel="member">
	{#snippet brand()}
		<div class="flex items-center gap-2 px-6 py-5">
			<span class="truncate text-xl font-bold">CorvMC</span>
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
		<NavItem href="/member/equipment" label="Equipment">
			{#snippet icon()}<IconTool />{/snippet}
		</NavItem>

		<NavGroup title="My Bands">
			{#each data.userBands as band}
				<NavItem href={`/band/${band.slug}`} label={band.name}>
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
	{/snippet}
	{@render children()}
</AppShell>
