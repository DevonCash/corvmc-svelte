<script lang="ts">
	import { getMemberStanding, restoreListingTrust } from '$lib/remote/community-events.remote';
	import { getSuggestionStandingFor, restoreSuggestionTrust } from '$lib/remote/suggestions.remote';
	import {
		getMemberMessagingStanding,
		setMemberMessaging
	} from '$lib/remote/direct-messages.remote';
	import { getFlagsAgainstUser, getFlagsByUser } from '$lib/remote/flags.remote';
	import { getUserThreads } from '$lib/remote/inbox.remote';
	import { getUserNotifications } from '$lib/remote/notifications.remote';
	import { getUserMarketing } from '$lib/remote/marketing.remote';
	import { getUserOverview } from '$lib/remote/users.remote';
	import AsyncCard from './AsyncCard.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import Table from '$lib/components/shared/Table.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import Alert from '$lib/components/shared/Alert.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import { rowLink } from '$lib/actions/row-link';
	import { resolve } from '$app/paths';
	import { formatDateShortYear, relativeDay } from '$lib/utils/format';

	let { id, email }: { id: string; email: string } = $props();

	const restoreFields = restoreListingTrust.fields;
	const restoreSuggestionFields = restoreSuggestionTrust.fields;
	const messagingFields = setMemberMessaging.fields;
</script>

<!--
	Standing renders only when it is bad. A "standing: fine" card on every member
	would be noise, and the point of this one is that it appears when something
	happened.
-->
{#await getMemberStanding(id) then standing}
	{#if standing.requiresReview}
		<InfoCard title="Community listings">
			<p class="text-sm">
				This member's listings are reviewed by staff before they go on the public calendar, after a
				report was upheld against one of them.
			</p>
			{#if standing.reason}
				<p class="mt-1 text-muted">Staff note: "{standing.reason}"</p>
			{/if}
			<div class="mt-3">
				<Action
					action={restoreListingTrust}
					label="Restore direct publishing"
					successToast="Trust restored"
					variant="default"
					size="sm"
					onsuccess={() => {
						void getMemberStanding(id).refresh();
						void getUserOverview(id).refresh();
					}}
				>
					{#snippet form()}
						<input {...restoreFields.userId.as('hidden', id)} />
						<p class="py-2">Let this member publish listings straight to the calendar again?</p>
					{/snippet}
				</Action>
			</div>
		</InfoCard>
	{/if}
{/await}

<!--
	Suggestion standing is tracked separately from listing standing: an upheld
	report about an event shouldn't quietly cost someone their suggestion-posting
	rights, or the reverse. Same render-only-when-revoked rule as above.
-->
{#await getSuggestionStandingFor(id) then suggestionStanding}
	{#if suggestionStanding.requiresReview}
		<InfoCard title="Suggestions">
			<p class="text-sm">
				This member's suggestions are reviewed by staff before they go on the board, after a report
				was upheld against one of them.
			</p>
			{#if suggestionStanding.reason}
				<p class="mt-1 text-muted">Staff note: "{suggestionStanding.reason}"</p>
			{/if}
			{#if suggestionStanding.triggeringFlagId}
				<p class="mt-1 text-sm">
					<a class="link" href={resolve(`/staff/flags/${suggestionStanding.triggeringFlagId}`)}>
						See the report
					</a>
				</p>
			{/if}
			<div class="mt-3">
				<Action
					action={restoreSuggestionTrust}
					label="Restore posting trust"
					successToast="Trust restored"
					variant="default"
					size="sm"
					onsuccess={() => {
						void getSuggestionStandingFor(id).refresh();
					}}
				>
					{#snippet form()}
						<input {...restoreSuggestionFields.userId.as('hidden', id)} />
						<p class="py-2">Let this member post suggestions straight to the board again?</p>
					{/snippet}
				</Action>
			</div>
		</InfoCard>
	{/if}
{/await}

<!--
	Unlike the two standings above, this card always renders. Those two only
	appear when something has gone wrong; this one is also the control staff use
	to switch messaging off for an account, which they need to reach whether or
	not there is anything wrong yet — it is how we handle the occasional under-18
	member, since the site has no age of its own.
-->
{#await getMemberMessagingStanding(id) then messaging}
	<InfoCard title="Direct messages">
		<p class="text-sm">
			{#if messaging.status === 'disabled'}
				Direct messaging is switched off for this account.
			{:else if messaging.status === 'restricted'}
				This member can reply to conversations they are already in, but cannot start new ones.
			{:else}
				This member can send and receive direct messages.
			{/if}
		</p>
		{#if messaging.reason}
			<p class="mt-1 text-muted">Note: "{messaging.reason}"</p>
		{/if}
		{#if messaging.status !== 'none' && messaging.source === 'member'}
			<p class="mt-1 text-muted">They switched this off themselves.</p>
		{/if}

		<div class="mt-3 flex flex-wrap gap-2">
			{#if messaging.status !== 'disabled'}
				<Action
					action={setMemberMessaging}
					label="Switch messaging off"
					successToast="Messaging switched off"
					variant="default"
					size="sm"
					onsuccess={() => {
						void getMemberMessagingStanding(id).refresh();
					}}
				>
					{#snippet form()}
						<input {...messagingFields.userId.as('hidden', id)} />
						<input {...messagingFields.status.as('hidden', 'disabled')} />
						<p class="py-2">
							They will not be able to send or receive direct messages, and their existing
							conversations will disappear from the other members' lists.
						</p>
						<label class="form-control w-full">
							<div class="label"><span class="label-text">Reason (shown to them)</span></div>
							<input
								{...messagingFields.reason.as('text')}
								class="input w-full"
								maxlength="500"
								placeholder="e.g. Under 18"
							/>
						</label>
					{/snippet}
				</Action>
			{/if}
			{#if messaging.status !== 'none'}
				<Action
					action={setMemberMessaging}
					label="Restore messaging"
					successToast="Messaging restored"
					variant="default"
					size="sm"
					outline
					onsuccess={() => {
						void getMemberMessagingStanding(id).refresh();
					}}
				>
					{#snippet form()}
						<input {...messagingFields.userId.as('hidden', id)} />
						<input {...messagingFields.status.as('hidden', 'none')} />
						<p class="py-2">Let this member send and receive direct messages again?</p>
					{/snippet}
				</Action>
			{/if}
		</div>
	</InfoCard>
{/await}

<AsyncCard title="Reports against this member" result={getFlagsAgainstUser(id)}>
	{#snippet children(flags)}
		{#if flags.length === 0}
			<EmptyState title="No reports" description="Nobody has reported this member's profile." />
		{:else}
			<Table>
				{#snippet head()}
					<th class="w-px"><span class="sr-only">Status</span></th>
					<th>Reason</th>
					<th class="col-extra">Filed</th>
				{/snippet}
				{#each flags as f (f.id)}
					<tr class="hover" use:rowLink={resolve(`/staff/flags/${f.id}`)}>
						<td class="w-px"><StatusBadge status={f.status} /></td>
						<td class="cell-primary">
							<a class="font-medium" href={resolve(`/staff/flags/${f.id}`)}>{f.reason}</a>
							<div class="text-muted">by {f.reportedByName ?? 'Anonymous'}</div>
						</td>
						<td class="col-extra whitespace-nowrap">{formatDateShortYear(f.createdAt)}</td>
					</tr>
				{/each}
			</Table>
		{/if}
	{/snippet}
</AsyncCard>

<AsyncCard title="Reports they filed" result={getFlagsByUser(id)}>
	{#snippet children(flags)}
		{#if flags.length === 0}
			<EmptyState title="None filed" description="This member has not reported anyone." />
		{:else}
			<Table>
				{#snippet head()}
					<th class="w-px"><span class="sr-only">Status</span></th>
					<th>About</th>
					<th class="col-extra">Filed</th>
				{/snippet}
				{#each flags as f (f.id)}
					<tr class="hover" use:rowLink={resolve(`/staff/flags/${f.id}`)}>
						<td class="w-px"><StatusBadge status={f.status} /></td>
						<td class="cell-primary">
							<a class="font-medium" href={resolve(`/staff/flags/${f.id}`)}>{f.entityLabel}</a>
							<div class="text-muted">{f.reason}</div>
						</td>
						<td class="col-extra whitespace-nowrap">{formatDateShortYear(f.createdAt)}</td>
					</tr>
				{/each}
			</Table>
		{/if}
	{/snippet}
</AsyncCard>

<AsyncCard title="Conversations" result={getUserThreads({ userId: id, email })}>
	{#snippet children(data)}
		{@const groups = [
			{ label: 'Portal', rows: data.portal },
			{ label: 'By email address', rows: data.byEmail }
		]}
		{#if data.portal.length === 0 && data.byEmail.length === 0}
			<EmptyState
				title="No conversations"
				description="Nothing in the inbox from this member, by portal or by email."
			/>
		{:else}
			<p class="mb-3 text-muted">
				{data.open} open · {data.unread} unread by them
			</p>
			{#each groups as group (group.label)}
				{#if group.rows.length > 0}
					<h4 class="mt-3 mb-1 text-subtle font-semibold uppercase">{group.label}</h4>
					<Table>
						{#snippet head()}
							<th class="w-px"><span class="sr-only">Status</span></th>
							<th>Subject</th>
							<th class="col-extra">Last message</th>
						{/snippet}
						{#each group.rows as t (t.id)}
							<tr class="hover" use:rowLink={resolve(`/staff/inbox/${t.id}`)}>
								<td class="w-px"><StatusBadge status={t.status} /></td>
								<td class="cell-primary">
									<a class="font-medium" href={resolve(`/staff/inbox/${t.id}`)}>
										{t.subject ?? '(no subject)'}
									</a>
									<div class="text-muted">{t.preview ?? ''}</div>
								</td>
								<td class="col-extra whitespace-nowrap">
									{t.lastMessageAt ? relativeDay(t.lastMessageAt) : '—'}
								</td>
							</tr>
						{/each}
					</Table>
				{/if}
			{/each}
		{/if}
	{/snippet}
</AsyncCard>

<!--
	Preferences alongside the sends, because the question they answer together is
	"why didn't they get the email?" — which is unanswerable from either half.
-->
<AsyncCard title="Notifications" result={getUserNotifications(id)}>
	{#snippet children(data)}
		<h4 class="mb-1 text-subtle font-semibold uppercase">Channels</h4>
		{@const overrides = Object.entries(data.preferences)}
		{#if overrides.length === 0}
			<p class="mb-4 text-muted">All defaults — nothing has been turned off for this member.</p>
		{:else}
			<!-- Only types they have changed are stored, so this list is the set of
			     deliberate overrides rather than the whole catalogue. Everything
			     absent is on. -->
			<div class="mb-4 flex flex-wrap gap-1">
				{#each overrides as [type, pref] (type)}
					<Badge size="sm" variant={pref.email || pref.inApp ? undefined : 'ghost'}>
						{type.replace(/_/g, ' ')}
						{[pref.email && 'email', pref.inApp && 'in-app', pref.sms && 'SMS']
							.filter(Boolean)
							.join(' · ') || 'off'}
					</Badge>
				{/each}
			</div>
		{/if}

		<h4 class="mt-3 mb-1 text-subtle font-semibold uppercase">
			Recent ({data.unread} unread)
		</h4>
		{#if data.items.length === 0}
			<p class="text-muted">Nothing sent yet.</p>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each data.items as n (n.id)}
					<li class="text-sm">
						<span class="font-medium">{n.title}</span>
						<span class="opacity-60"> · {relativeDay(n.createdAt)}</span>
						{#if !n.readAt}
							<Badge size="sm" variant="info">Unread</Badge>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{/snippet}
</AsyncCard>

<AsyncCard title="Email lists" result={getUserMarketing(id)}>
	{#snippet children(data)}
		{#if !data.subscriber}
			<EmptyState
				title="Not a subscriber"
				description="No marketing subscriber record is linked to this account."
			/>
		{:else}
			{#if data.subscriber.suppressedAt}
				<Alert type="warning" class="mb-3">
					Suppressed{data.subscriber.suppressionReason
						? ` (${data.subscriber.suppressionReason})`
						: ''} since {formatDateShortYear(data.subscriber.suppressedAt)} — club mail is not being delivered.
				</Alert>
			{/if}
			<div class="flex flex-wrap gap-1">
				{#each data.audiences as a (a.audienceId)}
					<a href={resolve(`/staff/marketing/audiences/${a.audienceId}`)}>
						<Badge size="sm">{a.audienceName}</Badge>
					</a>
				{:else}
					<span class="text-muted">Not on any list.</span>
				{/each}
			</div>
		{/if}
	{/snippet}
</AsyncCard>
