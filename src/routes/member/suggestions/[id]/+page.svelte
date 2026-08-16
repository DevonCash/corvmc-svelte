<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Alert from '$lib/components/shared/Alert.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { IconFlag, IconCaretUpFilled } from '@tabler/icons-svelte';
	import { formatDateTime } from '$lib/utils/format';
	import { suggestionCategoryLabels } from '$lib/config';
	import {
		getSuggestionDetail,
		getMySuggestionStanding,
		toggleSuggestionVote,
		flagSuggestion
	} from '$lib/remote/suggestions.remote';

	let id = $derived(page.params.id!);
	let s = $derived(await getSuggestionDetail(id));
	let standing = $derived(await getMySuggestionStanding());

	let isMine = $derived(s.authorUserId === standing.viewerUserId);
	let vote = $derived(toggleSuggestionVote.for(s.id));
	let flag = $derived(flagSuggestion.for(s.id));

	function refresh() {
		void getSuggestionDetail(id).refresh();
	}

	// Only the author ever sees these — everyone else 404s before reaching here.
	const withheldCopy: Record<string, string> = {
		pending_review:
			'This is waiting for staff to look at it before it goes on the board. Only you can see it right now.',
		under_review:
			"Someone reported this, so it's off the board while staff take a look. Most reports are dismissed — if this one is, it goes straight back up.",
		hidden: 'Staff took this off the board.'
	};
</script>

<PageHeader title={s.title} subtitle="Suggestion" backHref="/member/suggestions">
	{#if s.status !== 'open'}
		<StatusBadge status={s.status} label />
	{/if}
</PageHeader>

<PageContent width="3xl">
	{#if s.mergedIntoId}
		<Alert type="info" href={resolve(`/member/suggestions/${s.mergedIntoId}`)}>
			Merged into <span class="font-medium">{s.mergedIntoTitle ?? 'another suggestion'}</span> — the votes
			moved across.
		</Alert>
	{:else if s.visibility !== 'visible'}
		<Alert type={s.visibility === 'hidden' ? 'error' : 'warning'}>
			<p>
				{withheldCopy[s.visibility] ?? 'This is not on the board right now.'}
				{#if s.visibilityNote}
					Staff's note: <span class="italic">{s.visibilityNote}</span>
				{/if}
			</p>
		</Alert>
	{/if}

	<InfoCard title="Suggestion">
		<div class="flex items-start gap-4">
			<Form remote={vote} class="shrink-0" onsuccess={refresh}>
				<input {...vote.fields.suggestionId.as('hidden', s.id)} />
				<SubmitButton
					label={String(s.voteCount)}
					disabled={s.visibility !== 'visible' || !!s.mergedIntoId}
					class="btn-sm h-auto flex-col gap-0 py-1 {s.hasVoted ? 'btn-primary' : 'btn-outline'}"
				>
					{#snippet icon()}<IconCaretUpFilled size={16} />{/snippet}
				</SubmitButton>
			</Form>

			<div class="min-w-0 grow space-y-3">
				<Badge size="sm" variant="outline">
					{suggestionCategoryLabels[s.category as keyof typeof suggestionCategoryLabels] ??
						s.category}
				</Badge>
				<p class="whitespace-pre-wrap">{s.body}</p>
				<div class="text-sm opacity-60">
					Suggested by {s.authorName ?? 'a former member'} · {formatDateTime(s.createdAt)}
				</div>
			</div>

			{#if !isMine && s.visibility === 'visible'}
				<Action
					action={flag}
					label="Flag for review"
					iconOnly
					modalTitle="Flag for review"
					submitLabel="Send report"
					successToast="Reported — staff will take a look"
					class="btn-ghost btn-sm shrink-0"
					onsuccess={refresh}
				>
					{#snippet icon()}<IconFlag size={16} />{/snippet}
					{#snippet form()}
						<input {...flag.fields.suggestionId.as('hidden', s.id)} />
						<p class="mb-3 text-sm opacity-70">
							This takes the suggestion off the board straight away while staff look at it. If they
							don't agree with the report, it goes back up.
						</p>
						<FormField name="reason" type="text" label="What's the problem?" />
						<FormField name="description" type="textarea" label="Anything else? (optional)" />
					{/snippet}
				</Action>
			{/if}
		</div>
	</InfoCard>

	{#if s.responseBody}
		<InfoCard title="Official response">
			<p class="whitespace-pre-wrap">{s.responseBody}</p>
			<p class="mt-2 text-sm opacity-60">
				{s.responderName ?? 'Staff'}{s.responseAt ? ` · ${formatDateTime(s.responseAt)}` : ''}
			</p>
		</InfoCard>
	{/if}
</PageContent>
