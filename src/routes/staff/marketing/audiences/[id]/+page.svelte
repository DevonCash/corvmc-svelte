<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import {
		DeleteAudienceAction,
		BulkAddMembersAction,
		AddSubscriberAction,
		RemoveSubscriberAction
	} from '$lib/components/shared/actions';
	import {
		getAudienceDetail,
		getAudienceSubscribers,
		updateAudienceCommand
	} from './data.remote';
	import Badge from '$lib/components/shared/Badge.svelte';

	let id = $derived(page.params.id!);
	let audienceData = $derived(await getAudienceDetail(id));
	let subscribers = $derived(await getAudienceSubscribers(id));
</script>

	{#if audienceData}
		<PageHeader subtitle="Audience" title={audienceData.name} backHref="/staff/marketing/audiences">
			<DeleteAudienceAction audienceId={id} onsuccess={() => goto('/staff/marketing/audiences')} />
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
					<BulkAddMembersAction audienceId={id} onsuccess={(result) => {
						const r = result as { added?: number };
						toast.success(`Added ${r?.added ?? 0} members`);
					}} />

					<label class="label cursor-pointer justify-start gap-3">
						<input
							type="checkbox"
							class="toggle toggle-sm"
							checked={audienceData.allowOptIn}
							onchange={async (e) => {
								const checked = (e.target as HTMLInputElement).checked;
								await updateAudienceCommand({ allowOptIn: checked });
								toast.success(checked ? 'Opt-in enabled' : 'Opt-in disabled');
							}}
						/>
						<span class="text-sm">Allow public opt-in</span>
					</label>
				</div>
			</InfoCard>
		</div>

		<!-- Add Subscriber -->
		<InfoCard title="Add Subscriber" class="mb-6">
			<AddSubscriberAction audienceId={id} />
		</InfoCard>

		<!-- Subscriber List -->
		<InfoCard title="Subscribers ({audienceData.subscriberCount})">
			<DataTable data={subscribers} empty="No subscribers yet">
				<Column key="email" header="Email">
					{#snippet cell(_, s)}
						<span class="font-mono text-sm">{s.email}</span>
					{/snippet}
				</Column>
				<Column key="name" header="Name">
					{#snippet cell(_, s)}
						{s.name ?? '—'}
					{/snippet}
				</Column>
				<Column key="status" header="Status" shrink>
					{#snippet cell(_, s)}
						{#if s.unsubscribedAt}
							<Badge variant="ghost" size="xs">Unsubscribed</Badge>
						{:else}
							<Badge variant="success" size="xs">Active</Badge>
						{/if}
					{/snippet}
				</Column>
				<Column key="createdAt" header="Joined" type="date" shrink />
				<Column key="actions" header="" shrink stopClick>
					{#snippet cell(_, s)}
						<RemoveSubscriberAction audienceId={id} subscriberId={s.subscriberId} email={s.email} />
					{/snippet}
				</Column>
			</DataTable>
		</InfoCard>
		</PageContent>
	{/if}


