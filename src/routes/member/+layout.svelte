<script lang="ts">
	import {
		IconLayoutDashboard,
		IconStar,
		IconCalendar,
		IconCalendarEvent,
		IconAddressBook,
		IconTool,
		IconPlus,
		IconHelp,
		IconMetronome
	} from '@tabler/icons-svelte';
	import AppShell from '$lib/components/shared/AppShell.svelte';
	import Nav from '$lib/components/shared/Nav';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import ErrorToastBoundary from '$lib/components/shared/ErrorToastBoundary.svelte';
	import type { MemberLayoutResponse } from '$lib/server/db/schema/api';

	let { data, children }: { data: MemberLayoutResponse; children: import('svelte').Snippet } = $props();

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
		<Nav.Item href="/member" label="Dashboard">
			{#snippet icon()}<IconLayoutDashboard />{/snippet}
		</Nav.Item>
		<Nav.Item href="/member/reservations" label="Practice">
			{#snippet icon()}<IconMetronome />{/snippet}
		</Nav.Item>
		<Nav.Item href="/member/events" label="Events">
			{#snippet icon()}<IconCalendarEvent />{/snippet}
		</Nav.Item>
		<Nav.Item href="/member/directory" label="Directory">
			{#snippet icon()}<IconAddressBook />{/snippet}
		</Nav.Item>
		<!-- <Nav.Item href="/member/equipment" label="Equipment">
			{#snippet icon()}<IconTool />{/snippet}
		</Nav.Item> -->

		<Nav.Group title="My Bands">
			{#snippet action()}
				<a href="/member/bands/create" class="btn btn-ghost btn-xs btn-square" title="Create Band">
					<IconPlus size={14} />
				</a>
			{/snippet}
			{#each data.userBands as band}
				<Nav.Item href={`/band/${band.slug}`} label={band.name}>
					{#snippet icon()}
						<Avatar
							class="size-8"
							src={band.avatarKey ? `/api/bands/${band.id}/avatar` : undefined}
							name={band.name}
						/>
					{/snippet}
				</Nav.Item>
			{/each}
			<Nav.Item href="/member/bands/create" label="Create Band">
				{#snippet icon()}<IconPlus />{/snippet}
			</Nav.Item>
		</Nav.Group>

		<div class="flex grow"></div>

		<Nav.Item href="/member/help" label="Help">
			{#snippet icon()}<IconHelp />{/snippet}
		</Nav.Item>
		<Nav.Item href="/member/membership" label="Membership">
			{#snippet icon()}<IconStar />{/snippet}
		</Nav.Item>
	{/snippet}
	<ErrorToastBoundary>
		{@render children()}
	</ErrorToastBoundary>
</AppShell>
