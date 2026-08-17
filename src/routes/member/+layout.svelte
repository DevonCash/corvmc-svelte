<script lang="ts">
	import {
		IconLayoutDashboard,
		IconStar,
		IconCalendarEvent,
		IconAddressBook,
		IconPlus,
		IconHelp,
		IconMetronome,
		IconMessages,
		IconUser,
		IconSettings,
		IconHeartHandshake,
		IconBulb
	} from '@tabler/icons-svelte';
	import AppShell from '$lib/components/shared/AppShell.svelte';
	import Nav from '$lib/components/shared/Nav';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import ErrorToastBoundary from '$lib/components/shared/ErrorToastBoundary.svelte';
	import { getMemberLayout } from '$lib/remote/layout.remote';

	let { children } = $props();

	let layout = $derived(await getMemberLayout());

	const panels = $derived([
		{ key: 'member', label: 'Member', href: '/member', type: 'member' as const },
		...(layout.isStaff
			? [{ key: 'staff', label: 'Staff', href: '/staff', type: 'staff' as const }]
			: []),
		...layout.userBands.map((b) => ({
			key: b.slug,
			label: b.name,
			href: `/band/${b.slug}`,
			type: 'band' as const
		}))
	]);
</script>

<AppShell drawerId="member-drawer" user={layout.user} {panels} activePanel="member">
	{#snippet brand()}
		<div class="flex items-center gap-2 px-6 py-5">
			<span class="truncate text-xl font-bold">CorvMC</span>
		</div>
	{/snippet}
	{#snippet navigation()}
		<Nav.Item href="/member" label="Dashboard">
			{#snippet icon()}<IconLayoutDashboard />{/snippet}
		</Nav.Item>
		<Nav.Item href="/member/messages" label="Messages" badge={layout.messagesUnread}>
			{#snippet icon()}<IconMessages />{/snippet}
		</Nav.Item>
		<Nav.Item href="/member/reservations" label="Reservations">
			{#snippet icon()}<IconMetronome />{/snippet}
		</Nav.Item>
		<Nav.Collapsible href="/member/events" label="Events" childHrefs={['/member/events']}>
			{#snippet icon()}<IconCalendarEvent />{/snippet}
			<Nav.Item href="/member/events/submit" label="Add a Show">
				{#snippet icon()}<IconPlus />{/snippet}
			</Nav.Item>
		</Nav.Collapsible>
		<Nav.Item href="/member/directory" label="Directory">
			{#snippet icon()}<IconAddressBook />{/snippet}
		</Nav.Item>
		{#if layout.features.volunteering}
			<Nav.Item href="/member/volunteer" label="Volunteering">
				{#snippet icon()}<IconHeartHandshake />{/snippet}
			</Nav.Item>
		{/if}
		<!-- Not flag-gated: a suggestion board with no audience collects
		     single-vote posts, so there is nothing useful to dark-launch. -->
		<Nav.Item href="/member/suggestions" label="Suggestions">
			{#snippet icon()}<IconBulb />{/snippet}
		</Nav.Item>

		<Nav.Group title="My Bands">
			{#snippet action()}
				<Button href="/member/bands" class="btn-ghost btn-xs">All</Button>
			{/snippet}
			{#each layout.userBands as band (band.slug)}
				<Nav.Item href={`/band/${band.slug}`} label={band.name}>
					{#snippet icon()}
						<Avatar
							class="size-8"
							size="avatar-sm"
							src={band.avatarUrl ?? undefined}
							name={band.name}
						/>
					{/snippet}
				</Nav.Item>
			{/each}
			<Nav.Item href="/member/bands?create=1" label="Create Band" data-sveltekit-reload>
				{#snippet icon()}<IconPlus />{/snippet}
			</Nav.Item>
		</Nav.Group>

		<div class="flex grow"></div>

		<Nav.Item href="/member/profile" label="Profile">
			{#snippet icon()}<IconUser />{/snippet}
		</Nav.Item>
		<Nav.Item href="/member/account" label="Account">
			{#snippet icon()}<IconSettings />{/snippet}
		</Nav.Item>
		{#if layout.features.helpArticles}
			<Nav.Item href="/member/help" label="Help">
				{#snippet icon()}<IconHelp />{/snippet}
			</Nav.Item>
		{/if}
		<Nav.Item href="/member/membership" label="Membership">
			{#snippet icon()}<IconStar />{/snippet}
		</Nav.Item>
	{/snippet}
	<ErrorToastBoundary>
		{@render children()}
	</ErrorToastBoundary>
</AppShell>
