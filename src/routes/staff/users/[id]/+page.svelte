<script lang="ts">
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SvelteSet } from 'svelte/reactivity';
	import { getUser, getUserOverview } from '$lib/remote/users.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import TabBar from '$lib/components/shared/TabBar.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import { TAB_LABELS, parseTab, type TabKey } from './tabs';
	import UserScoreboard from './panels/UserScoreboard.svelte';
	import OverviewPanel from './panels/OverviewPanel.svelte';
	import SpacePanel from './panels/SpacePanel.svelte';
	import BandsPanel from './panels/BandsPanel.svelte';
	import VolunteerPanel from './panels/VolunteerPanel.svelte';
	import MoneyPanel from './panels/MoneyPanel.svelte';
	import CommsPanel from './panels/CommsPanel.svelte';
	import AccountPanel from './panels/AccountPanel.svelte';

	let id = $derived(page.params.id!);

	// The only two queries the page itself makes. `getUserOverview` is what pays
	// for the tabs: it backs the identity badges, the scoreboard, every tab
	// badge and the whole Overview tab, so the default view of a member costs
	// two requests instead of the twenty an untabbed version of this page would.
	let [member, overview] = $derived(await Promise.all([getUser(id), getUserOverview(id)]));

	// Seeded from the query string and mirrored back into it, so a staff member
	// can hand someone a link to the tab they are talking about. Local state
	// rather than reading `page.url` directly, so a click re-renders immediately
	// instead of waiting on the navigation that records it.
	const initialTab = parseTab(page.url.searchParams.get('tab'));
	let tab = $state<TabKey>(initialTab);

	// Keep-alive. A plain {#if} would unmount the Account panel on tab change and
	// silently discard a half-typed edit — Form's `guard` only fires on
	// navigation, and switching tabs is not one. Mounting on first visit and
	// hiding thereafter also means each panel's queries run exactly once.
	const visited = new SvelteSet<TabKey>([initialTab]);
	$effect(() => {
		visited.add(tab);
	});

	// Writes the URL, never state — `tab` above stays the source of truth.
	//
	// `replaceState` (shallow routing) rather than `goto(..., { replaceState })`,
	// which is what the filter bars on the list pages use. A tab change is not a
	// navigation, but `goto` is one, and `FormGuard` hooks `beforeNavigate`: with
	// the Account form dirty, every tab click cancelled the navigation and popped
	// "You have unsaved changes", whose <dialog> then swallowed pointer events for
	// the whole page. Shallow routing rewrites the address bar without running
	// beforeNavigate or any load, which is exactly what mirroring local state
	// wants. The address bar is all this needs to reach: `tab` is read back out of
	// `page.url` only on mount, so a reload or a copied link still lands right.
	$effect(() => {
		const href = `${resolve(`/staff/users/${id}`)}${tab === 'overview' ? '' : `?tab=${tab}`}`;
		if (location.pathname + location.search !== href) {
			replaceState(href, {});
		}
	});

	// Badges state a size, and are omitted at zero — a "0" on every tab of a new
	// member's record is noise that hides the one tab with something in it.
	const badge = (n: number) => (n > 0 ? n : undefined);

	const attentionCount = $derived(
		[
			!!member.deletedAt,
			overview.standings.community_event.status !== 'none',
			overview.standings.suggestion.status !== 'none',
			overview.counts.openFlagsAgainst > 0,
			overview.counts.overdueLoans > 0,
			overview.counts.unpaidReservations > 0,
			overview.counts.pendingHourLogs > 0,
			overview.counts.certsNeedingAttention > 0,
			overview.volunteer.stage === 'blocked',
			overview.membership.cancelAtPeriodEnd,
			overview.marketing.suppressed,
			overview.counts.unreadThreads > 0,
			overview.counts.pendingBandInvites > 0
		].filter(Boolean).length
	);

	const tabs = $derived([
		{ key: 'overview', label: TAB_LABELS.overview, badge: badge(attentionCount) },
		{ key: 'space', label: TAB_LABELS.space, badge: badge(overview.counts.upcomingReservations) },
		{ key: 'bands', label: TAB_LABELS.bands, badge: badge(overview.counts.bands) },
		{
			key: 'volunteer',
			label: TAB_LABELS.volunteer,
			badge: badge(overview.counts.pendingHourLogs)
		},
		{ key: 'money', label: TAB_LABELS.money },
		{
			key: 'comms',
			label: TAB_LABELS.comms,
			badge: badge(overview.counts.openThreads + overview.counts.openFlagsAgainst)
		},
		{ key: 'account', label: TAB_LABELS.account }
	]);
</script>

<PageHeader subtitle="Member" title={member.name} backHref="/staff/users">
	{#if member.deletedAt}
		<Badge variant="error" size="md">Deactivated</Badge>
	{/if}
	{#if overview.membership.sustaining}
		<Badge variant="success" size="md">Sustaining</Badge>
	{/if}
	{#each member.roles as role (role)}
		<Badge variant="info" size="md">{role}</Badge>
	{/each}
</PageHeader>

<PageContent width="full">
	<!-- Identity strip. Everything here is true regardless of which tab is open,
	     which is exactly why it sits above the TabBar rather than inside a tab. -->
	<div class="flex flex-wrap items-center gap-4">
		<Avatar src={member.avatarUrl ?? undefined} name={member.name} class="size-16" />
		<div class="min-w-0">
			<div class="flex flex-wrap items-baseline gap-2">
				<span class="text-lg font-medium">{member.name}</span>
				{#if member.pronouns}
					<span class="text-muted">{member.pronouns}</span>
				{/if}
				{#if member.memberNumber}
					<span class="text-muted">#{member.memberNumber}</span>
				{/if}
			</div>
			<div class="text-muted">
				<a class="link" href="mailto:{member.email}">{member.email}</a>
				{#if member.phone}
					· <a class="link" href="tel:{member.phone}">{member.phone}</a>
				{/if}
			</div>
		</div>
	</div>

	<UserScoreboard {overview} />

	<TabBar {tabs} active={tab} onchange={(key) => (tab = key as TabKey)} />

	{#if visited.has('overview')}
		<div class="space-y-6" class:hidden={tab !== 'overview'}>
			<OverviewPanel {overview} {member} onjump={(next) => (tab = next)} />
		</div>
	{/if}
	{#if visited.has('space')}
		<div class="space-y-6" class:hidden={tab !== 'space'}><SpacePanel {id} /></div>
	{/if}
	{#if visited.has('bands')}
		<div class="space-y-6" class:hidden={tab !== 'bands'}><BandsPanel {id} /></div>
	{/if}
	{#if visited.has('volunteer')}
		<div class="space-y-6" class:hidden={tab !== 'volunteer'}><VolunteerPanel {id} /></div>
	{/if}
	{#if visited.has('money')}
		<div class="space-y-6" class:hidden={tab !== 'money'}><MoneyPanel {id} /></div>
	{/if}
	{#if visited.has('comms')}
		<div class="space-y-6" class:hidden={tab !== 'comms'}>
			<CommsPanel {id} email={member.email} />
		</div>
	{/if}
	{#if visited.has('account')}
		<div class="space-y-6" class:hidden={tab !== 'account'}><AccountPanel {id} {member} /></div>
	{/if}
</PageContent>
