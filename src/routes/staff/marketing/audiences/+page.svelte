<script lang="ts">
	import { goto } from '$app/navigation';
	import { getAudiences, createAudienceCommand } from './data.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import { Field } from '$lib/components/shared/Form';

	let audiences = $derived(await getAudiences());

	let name = $state('');
	let slug = $state('');
	let description = $state('');
	let allowOptIn = $state(false);
	let slugManuallyEdited = $state(false);

	$effect(() => {
		if (!slugManuallyEdited && name) {
			slug = name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/-{2,}/g, '-')
				.replace(/^-|-$/g, '');
		}
	});
</script>

	<PageHeader title="Audiences" subtitle="Marketing">
		<Action
			action={async () => {
				const result = await createAudienceCommand({
					name: name.trim(),
					slug: slug.trim() || undefined,
					description: description.trim() || undefined,
					allowOptIn
				});
				name = '';
				slug = '';
				description = '';
				allowOptIn = false;
				slugManuallyEdited = false;
				return result;
			}}
			label="New Audience"
			modalTitle="New Audience"
			submitLabel="Create Audience"
			canSubmit={!!name.trim()}
			successToast="Audience created"
			class="btn-primary btn-sm"
			maxWidth="max-w-md"
			onsuccess={(result) => {
				const r = result as { audienceId?: string };
				if (r?.audienceId) goto(`/staff/marketing/audiences/${r.audienceId}`);
			}}
		>
			{#snippet form({ close })}
				<Field name="name" type="text" label="Name" bind:value={name} />
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Slug</legend>
					<input
						type="text"
						bind:value={slug}
						placeholder="newsletter"
						class="input-bordered input w-full font-mono text-sm"
						oninput={() => (slugManuallyEdited = true)}
					/>
					<p class="text-xs opacity-60 mt-1">Used in the signup URL: /subscribe/{slug || '...'}</p>
				</fieldset>
				<Field name="description" type="textarea" label="Description" bind:value={description} />
				<Field name="allowOptIn" type="checkbox" value={allowOptIn}
					checkboxLabel="Allow public opt-in" description="Show on public subscribe page and member account" />
			{/snippet}
		</Action>
	</PageHeader>

	<DataTable data={audiences} rowHref={(a) => `/staff/marketing/audiences/${a.id}`} empty="No audiences yet. Create one to start building your email lists.">
		<Column key="name" header="Name" sortable>
			{#snippet cell(_, a)}
				<div>
					<p class="font-medium">{a.name}</p>
					{#if a.description}
						<p class="text-sm opacity-60 truncate max-w-xs">{a.description}</p>
					{/if}
				</div>
			{/snippet}
		</Column>
		<Column key="subscriberCount" header="Subscribers" sortable shrink />
		<Column key="allowOptIn" header="Opt-in" shrink>
			{#snippet cell(_, a)}
				{#if a.allowOptIn}
					<span class="badge badge-success badge-sm">Public</span>
				{:else}
					<span class="badge badge-ghost badge-sm">Staff only</span>
				{/if}
			{/snippet}
		</Column>
		<Column key="createdAt" header="Created" type="date" shrink sortable />
	</DataTable>
