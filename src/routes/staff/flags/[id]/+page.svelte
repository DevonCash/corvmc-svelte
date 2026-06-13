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
	import { formatDateTime } from '$lib/utils/format';

	const entityLabels: Record<string, string> = {
		member_profile: 'Member profile',
		band_profile: 'Band profile'
	};

	let id = $derived(page.params.id!);
	let flag = $derived(await getFlagDetail(id));

	let entityHref = $derived(
		flag.entityType === 'band_profile'
			? resolve(`/staff/bands/${flag.entityId}`)
			: resolve(`/staff/users/${flag.entityId}`)
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
				<dd>{flag.reportedByName} <span class="opacity-60">({flag.reportedByEmail})</span></dd>

				<dt class="opacity-60">Reported</dt>
				<dd>{formatDateTime(flag.createdAt)}</dd>
			</dl>
		</InfoCard>

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
									<select
										class="select select-bordered w-full"
										{...fields.resolution.as('select')}
										bind:value={resolution}
									>
										<option value="resolved">Resolved — action taken</option>
										<option value="dismissed">Dismissed — no action needed</option>
									</select>
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
