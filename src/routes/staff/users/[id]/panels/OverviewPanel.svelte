<script lang="ts">
	import type { getUserOverview } from '$lib/remote/users.remote';
	import type { TabKey } from '../tabs';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import DefinitionList from '$lib/components/shared/DefinitionList/DefinitionList.svelte';
	import Fact from '$lib/components/shared/DefinitionList/Fact.svelte';
	import { formatDateShortYear, formatDateTimeShort } from '$lib/utils/format';
	import { formatVolunteerHours, standingScopeConfig } from '$lib/config';

	let {
		overview,
		member,
		onjump
	}: {
		overview: Awaited<ReturnType<typeof getUserOverview>>;
		member: {
			createdAt: Date;
			memberNumber: number | null;
			roles: string[];
			deletedAt: Date | null;
		};
		onjump: (tab: TabKey) => void;
	} = $props();

	// Every item is derived from the one overview query, so this tab issues no
	// requests of its own. That is deliberate: Overview is the default tab, and
	// a default tab that fans out to a dozen endpoints would undo the whole
	// reason the page is tabbed.
	type Attention = { text: string; tab: TabKey; tone: 'error' | 'warning' };

	const attention = $derived.by<Attention[]>(() => {
		const c = overview.counts;
		const items: Attention[] = [];

		if (member.deletedAt) {
			items.push({
				text: 'This account is deactivated. Their future bookings were cancelled when it happened, and reactivating does not bring them back.',
				tab: 'account',
				tone: 'error'
			});
		}
		// One line per restricted scope, in a fixed order so the list doesn't
		// reshuffle between members. Messaging is deliberately absent: its card on
		// the Comms tab always renders, so an alert pointing at it would be noise.
		for (const scope of ['community_event', 'suggestion'] as const) {
			const standing = overview.standings[scope];
			if (standing.status === 'none') continue;
			items.push({
				text: `${standingScopeConfig[scope].label} are held for review${standing.reason ? ` — ${standing.reason}` : ''}.`,
				tab: 'comms',
				tone: 'warning'
			});
		}
		if (c.openFlagsAgainst > 0) {
			items.push({
				text: `${c.openFlagsAgainst} unresolved report${c.openFlagsAgainst === 1 ? '' : 's'} against this member.`,
				tab: 'comms',
				tone: 'error'
			});
		}
		if (c.overdueLoans > 0) {
			items.push({
				text: `${c.overdueLoans} overdue equipment loan${c.overdueLoans === 1 ? '' : 's'}.`,
				tab: 'space',
				tone: 'error'
			});
		}
		if (c.unpaidReservations > 0) {
			items.push({
				text: `${c.unpaidReservations} booking${c.unpaidReservations === 1 ? '' : 's'} with cash still owed.`,
				tab: 'space',
				tone: 'warning'
			});
		}
		if (c.pendingHourLogs > 0) {
			items.push({
				text: `${c.pendingHourLogs} volunteer hour log${c.pendingHourLogs === 1 ? '' : 's'} waiting on review.`,
				tab: 'volunteer',
				tone: 'warning'
			});
		}
		if (c.certsNeedingAttention > 0) {
			items.push({
				text: `${c.certsNeedingAttention} clearance${c.certsNeedingAttention === 1 ? '' : 's'} expired or expiring.`,
				tab: 'volunteer',
				tone: 'warning'
			});
		}
		if (overview.volunteer.stage === 'blocked') {
			items.push({
				text: 'Volunteer signup is blocked pending guardian approval.',
				tab: 'volunteer',
				tone: 'warning'
			});
		}
		if (overview.membership.cancelAtPeriodEnd) {
			items.push({
				text: 'Membership is set to cancel at the end of the current period.',
				tab: 'money',
				tone: 'warning'
			});
		}
		if (overview.marketing.suppressed) {
			items.push({
				text: `Email is suppressed${overview.marketing.suppressionReason ? ` (${overview.marketing.suppressionReason})` : ''} — club mail is not reaching them.`,
				tab: 'comms',
				tone: 'warning'
			});
		}
		if (c.unreadThreads > 0) {
			items.push({
				text: `${c.unreadThreads} unread message${c.unreadThreads === 1 ? '' : 's'} in their portal inbox.`,
				tab: 'comms',
				tone: 'warning'
			});
		}
		if (c.pendingBandInvites > 0) {
			items.push({
				text: `${c.pendingBandInvites} band invitation${c.pendingBandInvites === 1 ? '' : 's'} never accepted.`,
				tab: 'bands',
				tone: 'warning'
			});
		}
		return items;
	});

	// The index. Each tile states a size and jumps to the tab that holds it, so
	// the cross-section is navigable without reading seven tabs to find what a
	// member actually takes part in.
	const programs = $derived([
		{
			label: 'Reservations',
			value: `${overview.counts.upcomingReservations} upcoming · ${overview.counts.pastReservations} past`,
			tab: 'space' as const
		},
		{
			label: 'Equipment loans',
			value: `${overview.counts.openLoans} open`,
			tab: 'space' as const
		},
		{ label: 'Bands', value: `${overview.counts.bands} active`, tab: 'bands' as const },
		{
			label: 'Shows played',
			value: `${overview.counts.upcomingShows} upcoming · ${overview.counts.pastShows} past`,
			tab: 'bands' as const
		},
		{
			label: 'Community listings',
			value: `${overview.counts.listings} submitted`,
			tab: 'bands' as const
		},
		{
			label: 'Tickets & RSVPs',
			value: `${overview.counts.tickets} tickets · ${overview.counts.rsvps} RSVPs`,
			tab: 'bands' as const
		},
		{
			label: 'Volunteer shifts',
			value: `${overview.counts.upcomingShifts} upcoming`,
			tab: 'volunteer' as const
		},
		{
			label: 'Volunteer hours',
			value: formatVolunteerHours(overview.counts.approvedMinutes),
			tab: 'volunteer' as const
		},
		{
			label: 'Clearances',
			value: `${overview.counts.certsHeld} held`,
			tab: 'volunteer' as const
		},
		{ label: 'Payments', value: `${overview.counts.payments} on record`, tab: 'money' as const },
		{
			label: 'Conversations',
			value: `${overview.counts.openThreads} open`,
			tab: 'comms' as const
		},
		{ label: 'Reports filed', value: `${overview.counts.flagsFiled}`, tab: 'comms' as const }
	]);
</script>

{#if attention.length > 0}
	<InfoCard title="Needs attention">
		<ul class="flex flex-col gap-2">
			{#each attention as item (item.text)}
				<li>
					<button
						type="button"
						class="flex w-full items-start gap-2 rounded-box px-2 py-1.5 text-left hover:bg-base-200"
						onclick={() => onjump(item.tab)}
					>
						<Badge variant={item.tone} size="sm" class="mt-0.5 shrink-0">
							{item.tone === 'error' ? '!' : '•'}
						</Badge>
						<span class="text-sm">{item.text}</span>
					</button>
				</li>
			{/each}
		</ul>
	</InfoCard>
{/if}

<InfoCard title="At a glance">
	<DefinitionList>
		<Fact label="Joined">{formatDateShortYear(member.createdAt)}</Fact>

		<Fact label="Last sign-in">
			{#if overview.lastLoginAt}
				{formatDateTimeShort(overview.lastLoginAt)}
			{:else}
				<span class="opacity-60">Never, or signed out everywhere</span>
			{/if}
		</Fact>

		<Fact label="Member no.">{member.memberNumber ?? '—'}</Fact>

		<Fact label="Roles" class="flex flex-wrap gap-1">
			{#each member.roles as role (role)}
				<Badge size="sm">{role}</Badge>
			{:else}
				<span class="opacity-60">Member</span>
			{/each}
		</Fact>

		<Fact label="Membership">
			{#if overview.membership.sustaining}
				Sustaining{overview.membership.hoursPerReset
					? ` · ${overview.membership.hoursPerReset / 2} hrs a month`
					: ''}
			{:else}
				Free tier
			{/if}
		</Fact>

		<Fact label="Directory">
			{overview.directory.visibility}
			{#if !overview.directory.profileComplete}
				<span class="opacity-60"> · profile incomplete</span>
			{/if}
		</Fact>
	</DefinitionList>
</InfoCard>

<InfoCard title="Programs">
	<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
		{#each programs as p (p.label)}
			<button
				type="button"
				class="rounded-box border border-base-300 px-3 py-2 text-left hover:bg-base-200"
				onclick={() => onjump(p.tab)}
			>
				<div class="text-xs opacity-60">{p.label}</div>
				<div class="text-sm font-medium">{p.value}</div>
			</button>
		{/each}
	</div>
</InfoCard>
