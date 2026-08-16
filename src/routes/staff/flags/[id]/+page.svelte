<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { getFlagDetail, resolveFlag } from '$lib/remote/flags.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import Select from '$lib/components/shared/Form/Select.svelte';
	import { formatDateTime } from '$lib/utils/format';
	import ThreadTimeline from '$lib/components/inbox/ThreadTimeline.svelte';

	const entityLabels: Record<string, string> = {
		member_profile: 'Member profile',
		band_profile: 'Band profile',
		event: 'Event listing',
		inbox_thread: 'Direct conversation'
	};

	let id = $derived(page.params.id!);
	let flag = $derived(await getFlagDetail(id));

	let entityHref = $derived(
		flag.entityType === 'band_profile'
			? resolve(`/staff/bands/${flag.entityId}`)
			: flag.entityType === 'event'
				? resolve(`/events/${flag.entityId}`)
				: // A conversation has no staff page of its own — this report is the
					// only way to see it, which is deliberate.
					flag.entityType === 'inbox_thread'
					? resolve(`/staff/flags/${flag.id}`)
					: resolve(`/staff/users/${flag.entityId}`)
	);

	// The timeline is drawn from the reporter's point of view: their messages sit
	// on the right. Without this it falls back to inbound/outbound — the org's
	// point of view — and neither member is the org, so every bubble would land
	// on the same side.
	let reporterId = $derived(flag.reportedByUserId);

	// Staff can pull a still-published flagged event off the public guide while
	// resolving; the band's admins are notified with the resolution note.
	let canUnpublish = $derived(
		flag.entityType === 'event' && flag.eventContext?.status === 'published'
	);

	const { fields } = resolveFlag;
	let resolution = $state<'resolved' | 'dismissed'>('resolved');
	let notes = $state('');
</script>

<PageHeader subtitle="Content Flag" title={flag.entityLabel} backHref="/staff/flags">
	<StatusBadge status={flag.status} label />
</PageHeader>
<PageContent width="3xl">
	<div class="grid gap-6 lg:grid-cols-2 mb-6">
		<InfoCard title="Report">
			<dl class="grid gap-x-4 gap-y-2 text-sm" style="grid-template-columns: auto 1fr;">
				<dt class="opacity-60">Type</dt>
				<dd>{entityLabels[flag.entityType] ?? flag.entityType}</dd>

				<dt class="opacity-60">Content</dt>
				<dd>
					<a class="link" href={entityHref}>{flag.entityLabel}</a>
				</dd>

				<dt class="opacity-60">Reason</dt>
				<dd>{flag.reason}</dd>

				{#if flag.description}
					<dt class="opacity-60">Details</dt>
					<dd class="whitespace-pre-wrap">{flag.description}</dd>
				{/if}

				<dt class="opacity-60">Reported by</dt>
				<dd>
					{#if flag.reportedByName}
						{flag.reportedByName} <span class="opacity-60">({flag.reportedByEmail})</span>
					{:else}
						Anonymous visitor
					{/if}
				</dd>

				<dt class="opacity-60">Reported</dt>
				<dd>{formatDateTime(flag.createdAt)}</dd>
			</dl>
		</InfoCard>

		{#if flag.threadContext}
			<InfoCard title="Conversation">
				<p class="mb-3 text-sm opacity-70">
					A private conversation between two members. It is not in the inbox and has no page of its
					own — this report is what makes it readable.
				</p>
				<dl class="grid gap-x-4 gap-y-2 text-sm" style="grid-template-columns: auto 1fr;">
					<dt class="opacity-60">Between</dt>
					<dd class="flex flex-wrap gap-2">
						{#each flag.threadContext.participants as p (p.userId)}
							<a class="link" href={resolve(`/staff/users/${p.userId}`)}>
								{p.name}{#if p.isReporter}<span class="ml-1 opacity-60">(reported it)</span>{/if}
							</a>
						{/each}
					</dd>

					<dt class="opacity-60">Messages</dt>
					<dd>{flag.threadContext.messageCount}</dd>

					<dt class="opacity-60">Started</dt>
					<dd>{formatDateTime(flag.threadContext.createdAt)}</dd>
				</dl>

				<div class="mt-4">
					<ThreadTimeline messages={flag.threadContext.messages} viewerUserId={reporterId} />
				</div>
			</InfoCard>
		{/if}

		{#if flag.eventContext}
			<InfoCard title="Event details">
				<dl class="grid gap-x-4 gap-y-2 text-sm" style="grid-template-columns: auto 1fr;">
					<dt class="opacity-60">Title</dt>
					<dd class="font-medium">{flag.eventContext.title}</dd>

					<dt class="opacity-60">Date</dt>
					<dd>{formatDateTime(flag.eventContext.startsAt)}</dd>

					{#if flag.eventContext.location}
						<dt class="opacity-60">Venue</dt>
						<dd>{flag.eventContext.location}</dd>
					{/if}

					<dt class="opacity-60">By</dt>
					<dd>
						{#if flag.eventContext.band}
							<a class="link" href={resolve(`/directory/bands/${flag.eventContext.band.slug}`)}>
								{flag.eventContext.band.name}
							</a>
						{:else}
							CMC
						{/if}
					</dd>

					<dt class="opacity-60">Status</dt>
					<dd><StatusBadge status={flag.eventContext.status} label /></dd>
				</dl>
				<div class="mt-3">
					<Button href={entityHref} class="btn-outline btn-sm">View public listing</Button>
				</div>
			</InfoCard>
		{/if}

		<InfoCard title="Resolution" class="bg-base-200 shadow-none">
			{#if flag.status === 'pending'}
				<p class="text-sm opacity-70 mb-3">
					Review the reported content, then mark this flag resolved (action taken) or dismissed (no
					action needed).
				</p>
				<div class="flex gap-2">
					<Button href={entityHref} class="btn-outline btn-sm">View content</Button>
					<Action
						action={resolveFlag}
						label="Resolve / Dismiss"
						modalTitle="Resolve flag"
						submitLabel="Save"
						successToast="Flag updated"
						class="btn-primary btn-sm"
						onsuccess={() => void getFlagDetail(id).refresh()}
					>
						{#snippet form()}
							<input {...fields.flagId.as('hidden', id)} />
							<div class="space-y-3">
								<label class="form-control w-full">
									<div class="label"><span class="label-text">Resolution</span></div>
									<Select
										class="select-bordered w-full"
										{...fields.resolution.as('select')}
										bind:value={resolution}
									>
										<option value="resolved">Resolved — action taken</option>
										<option value="dismissed">Dismissed — no action needed</option>
									</Select>
								</label>
								<label class="form-control w-full">
									<div class="label"><span class="label-text">Notes (optional)</span></div>
									<textarea
										class="textarea textarea-bordered w-full"
										rows="3"
										{...fields.notes.as('text')}
										bind:value={notes}
									></textarea>
								</label>
								{#if flag.entityType === 'event' && flag.eventContext?.source === 'community' && resolution === 'resolved'}
									<!-- Say this out loud. Resolving a community-listing flag is
									     the only thing in the app that changes a member's
									     standing, and a staffer shouldn't discover that
									     afterwards. -->
									<p class="text-sm text-wrap opacity-70">
										Resolving this also means the member who posted it has their future listings
										checked by staff before they publish. Dismissing changes nothing.
									</p>
								{/if}
								{#if canUnpublish && resolution === 'resolved'}
									<label class="label cursor-pointer justify-start gap-2">
										<input class="checkbox checkbox-sm" {...fields.unpublishEvent.as('checkbox')} />
										<span class="label-text text-wrap">
											{#if flag.eventContext?.source === 'community'}
												Also unpublish this listing (removes it from the public gig guide and
												deletes its poster; the member is notified with your note)
											{:else}
												Also unpublish this event (removes it from the public gig guide; the band's
												admins are notified with your note)
											{/if}
										</span>
									</label>
								{/if}
							</div>
						{/snippet}
					</Action>
				</div>
			{:else}
				<dl class="grid gap-x-4 gap-y-2 text-sm" style="grid-template-columns: auto 1fr;">
					<dt class="opacity-60">Outcome</dt>
					<dd><StatusBadge status={flag.status} label /></dd>

					{#if flag.resolutionNotes}
						<dt class="opacity-60">Notes</dt>
						<dd class="whitespace-pre-wrap">{flag.resolutionNotes}</dd>
					{/if}

					{#if flag.resolvedAt}
						<dt class="opacity-60">Resolved</dt>
						<dd>{formatDateTime(flag.resolvedAt)}</dd>
					{/if}
				</dl>
				<div class="mt-3">
					<Button href={entityHref} class="btn-outline btn-sm">View content</Button>
				</div>
			{/if}
		</InfoCard>
	</div>
</PageContent>
