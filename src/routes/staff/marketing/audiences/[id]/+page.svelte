<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import { formatDate } from '$lib/utils/format';
	import {
		DeleteAudienceAction,
		BulkAddMembersAction,
		AddSubscriberAction,
		RemoveSubscriberAction
	} from '$lib/components/shared/actions';
	import {
		getAudienceDetail,
		getAudienceSubscribers,
		updateAudience
	} from '$lib/remote/marketing.remote';
	import Badge from '$lib/components/shared/Badge.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';

	const { fields } = updateAudience;

	let id = $derived(page.params.id!);
	let audienceData = $derived(await getAudienceDetail(id));
	let subscribers = $derived(await getAudienceSubscribers(id));

	// Local mirror of the opt-in setting so the toggle submits an explicit boolean
	// (the previous string-only checkbox could turn opt-in on but never off).
	let allowOptIn = $state(false);
	$effect(() => {
		allowOptIn = audienceData?.allowOptIn ?? false;
	});
</script>

{#if audienceData}
	<PageHeader subtitle="Audience" title={audienceData.name} backHref="/staff/marketing/audiences">
		<DeleteAudienceAction
			audienceId={id}
			onsuccess={() => goto(resolve('/staff/marketing/audiences'))}
		/>
	</PageHeader>
	<PageContent width="3xl">
		<div class="grid gap-6 lg:grid-cols-2 mb-6">
			<InfoCard title="Details">
				<dl class="grid gap-x-4 gap-y-2 text-sm" style="grid-template-columns: auto 1fr;">
					<dt class="opacity-60">Slug</dt>
					<dd class="font-mono text-xs">{audienceData.slug}</dd>

					<dt class="opacity-60">Subscribers</dt>
					<dd>{audienceData.subscriberCount} active</dd>

					<dt class="opacity-60">Opt-in</dt>
					<dd>{audienceData.allowOptIn ? 'Public' : 'Staff only'}</dd>

					<dt class="opacity-60">Created</dt>
					<dd>{new Date(audienceData.createdAt).toLocaleDateString()}</dd>
				</dl>

				{#if audienceData.description}
					<p class="text-sm opacity-70 mt-3">{audienceData.description}</p>
				{/if}

				{#if audienceData.allowOptIn}
					<div class="mt-3 p-2 bg-base-200 rounded text-xs">
						<span class="opacity-60">Signup URL:</span>
						<code class="ml-1">/subscribe/{audienceData.slug}</code>
					</div>
				{/if}
			</InfoCard>

			<InfoCard title="Actions">
				<div class="space-y-3">
					<BulkAddMembersAction audienceId={id} />

					<Form remote={updateAudience} successToast="Opt-in setting updated">
						<input {...fields.id.as('hidden', id)} />
						<input {...fields.allowOptIn.as('hidden', allowOptIn)} />
						<label class="label cursor-pointer justify-start gap-3">
							<input
								type="checkbox"
								class="toggle toggle-sm"
								bind:checked={allowOptIn}
								onchange={(e) => {
									(e.target as HTMLInputElement).form?.requestSubmit();
								}}
							/>
							<span class="text-sm">Allow public opt-in</span>
						</label>
					</Form>
				</div>
			</InfoCard>
		</div>

		<!-- Add Subscriber -->
		<InfoCard title="Add Subscriber" class="mb-6">
			<AddSubscriberAction audienceId={id} />
		</InfoCard>

		<!-- Subscriber List -->
		<InfoCard title="Subscribers ({audienceData.subscriberCount})">
			{#if subscribers.length === 0}
				<p class="text-center opacity-60 py-8">No subscribers yet</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="table">
						<thead>
							<tr>
								<th>Email</th>
								<th>Name</th>
								<th class="w-px">Status</th>
								<th class="w-px">Joined</th>
								<th class="w-px"></th>
							</tr>
						</thead>
						<tbody>
							{#each subscribers as s (s.subscriberId)}
								<tr class="hover">
									<td><span class="font-mono text-sm">{s.email}</span></td>
									<td>{s.name ?? '—'}</td>
									<td class="w-px">
										{#if s.unsubscribedAt}
											<Badge variant="ghost" size="xs">Unsubscribed</Badge>
										{:else}
											<Badge variant="success" size="xs">Active</Badge>
										{/if}
									</td>
									<td class="w-px">{formatDate(s.createdAt)}</td>
									<td class="w-px" onclick={(e) => e.stopPropagation()}>
										<RemoveSubscriberAction
											audienceId={id}
											subscriberId={s.subscriberId}
											email={s.email}
										/>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</InfoCard>
	</PageContent>
{/if}
