<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import {
		getAudienceDetail,
		getAudienceSubscribers,
		addSubscriberCommand,
		removeSubscriberCommand,
		bulkAddMembersCommand,
		deleteAudienceCommand,
		updateAudienceCommand
	} from './data.remote';

	let id = $derived(page.params.id!);
	let audienceData = $derived(await getAudienceDetail(id));
	let subscribers = $derived(await getAudienceSubscribers(id));

	let newEmail = $state('');
	let newName = $state('');
</script>

	{#if audienceData}
		<PageHeader subtitle="Audience" title={audienceData.name} backHref="/staff/marketing/audiences">
			<Action
				action={() => deleteAudienceCommand({})}
				label="Delete"
				confirm="Delete this audience? All subscribers will be removed."
				successToast="Audience deleted"
				class="btn-error btn-sm"
				onsuccess={() => goto('/staff/marketing/audiences')}
			/>
		</PageHeader>

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
					<Action
						action={async () => {
							const result = await bulkAddMembersCommand({});
							toast.success(`Added ${result?.added ?? 0} members`);
						}}
						label="Add all active members"
						class="btn-outline btn-sm"
					/>

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
			<Action
				action={async () => {
					await addSubscriberCommand({
						email: newEmail.trim(),
						name: newName.trim() || undefined
					});
					newEmail = '';
					newName = '';
				}}
				label="Add Subscriber"
				modalTitle="Add Subscriber"
				canSubmit={!!newEmail.trim()}
				successToast="Subscriber added"
				class="btn-primary btn-sm"
			>
				{#snippet form({ close })}
					<div>
						<label for="sub-email" class="text-xs opacity-60">Email</label>
						<input
							id="sub-email"
							type="email"
							bind:value={newEmail}
							placeholder="email@example.com"
							class="input-bordered input w-full"
							required
						/>
					</div>
					<div>
						<label for="sub-name" class="text-xs opacity-60">Name (optional)</label>
						<input
							id="sub-name"
							type="text"
							bind:value={newName}
							placeholder="Name"
							class="input-bordered input w-full"
						/>
					</div>
				{/snippet}
			</Action>
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
							<span class="badge badge-ghost badge-xs">Unsubscribed</span>
						{:else}
							<span class="badge badge-success badge-xs">Active</span>
						{/if}
					{/snippet}
				</Column>
				<Column key="createdAt" header="Joined" type="date" shrink />
				<Column key="actions" header="" shrink stopClick>
					{#snippet cell(_, s)}
						<Action
							action={() => removeSubscriberCommand({ subscriberId: s.subscriberId })}
							label="Remove"
							confirm={`Remove ${s.email} from this audience?`}
							successToast="Subscriber removed"
							class="btn-ghost btn-xs text-error"
						/>
					{/snippet}
				</Column>
			</DataTable>
		</InfoCard>
	{/if}


