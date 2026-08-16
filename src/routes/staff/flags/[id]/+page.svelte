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
	import DefinitionList from '$lib/components/shared/DefinitionList/DefinitionList.svelte';
	import Fact from '$lib/components/shared/DefinitionList/Fact.svelte';
	import { formatDateTime } from '$lib/utils/format';

	const entityLabels: Record<string, string> = {
		member_profile: 'Member profile',
		band_profile: 'Band profile',
		event: 'Event listing'
	};

	let id = $derived(page.params.id!);
	let flag = $derived(await getFlagDetail(id));

	let entityHref = $derived(
		flag.entityType === 'band_profile'
			? resolve(`/staff/bands/${flag.entityId}`)
			: flag.entityType === 'event'
				? resolve(`/events/${flag.entityId}`)
				: resolve(`/staff/users/${flag.entityId}`)
	);

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
			<DefinitionList>
				<Fact label="Type">{entityLabels[flag.entityType] ?? flag.entityType}</Fact>

				<Fact label="Content">
					<a class="link" href={entityHref}>{flag.entityLabel}</a>
				</Fact>

				<Fact label="Reason">{flag.reason}</Fact>

				{#if flag.description}
					<Fact label="Details" wrap>{flag.description}</Fact>
				{/if}

				<Fact label="Reported by">
					{#if flag.reportedByName}
						{flag.reportedByName} <span class="opacity-60">({flag.reportedByEmail})</span>
					{:else}
						Anonymous visitor
					{/if}
				</Fact>

				<Fact label="Reported">{formatDateTime(flag.createdAt)}</Fact>
			</DefinitionList>
		</InfoCard>

		{#if flag.eventContext}
			<InfoCard title="Event details">
				<DefinitionList>
					<Fact label="Title" class="font-medium">{flag.eventContext.title}</Fact>

					<Fact label="Date">{formatDateTime(flag.eventContext.startsAt)}</Fact>

					{#if flag.eventContext.location}
						<Fact label="Venue">{flag.eventContext.location}</Fact>
					{/if}

					<Fact label="By">
						{#if flag.eventContext.band}
							<a class="link" href={resolve(`/directory/bands/${flag.eventContext.band.slug}`)}>
								{flag.eventContext.band.name}
							</a>
						{:else}
							CMC
						{/if}
					</Fact>

					<Fact label="Status"><StatusBadge status={flag.eventContext.status} label /></Fact>
				</DefinitionList>
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
				<DefinitionList>
					<Fact label="Outcome"><StatusBadge status={flag.status} label /></Fact>

					{#if flag.resolutionNotes}
						<Fact label="Notes" wrap>{flag.resolutionNotes}</Fact>
					{/if}

					{#if flag.resolvedAt}
						<Fact label="Resolved">{formatDateTime(flag.resolvedAt)}</Fact>
					{/if}
				</DefinitionList>
				<div class="mt-3">
					<Button href={entityHref} class="btn-outline btn-sm">View content</Button>
				</div>
			{/if}
		</InfoCard>
	</div>
</PageContent>
