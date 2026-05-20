<script lang="ts">
	import Action from '../Action.svelte';
	import { actionFetch } from './api';
	import { Field } from '../Form';

	let {
		class: className = 'btn-primary btn-sm',
		onsuccess,
		...rest
	}: {
		class?: string;
		onsuccess?: (result: unknown) => void;
		[key: string]: unknown;
	} = $props();

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

	function execute() {
		const result = actionFetch('/api/marketing/audiences', {
			body: {
				name: name.trim(),
				slug: slug.trim() || undefined,
				description: description.trim() || undefined,
				allowOptIn
			}
		});
		name = '';
		slug = '';
		description = '';
		allowOptIn = false;
		slugManuallyEdited = false;
		return result;
	}
</script>

<Action
	action={execute}
	label="New Audience"
	modalTitle="New Audience"
	submitLabel="Create Audience"
	canSubmit={!!name.trim()}
	successToast="Audience created"
	class={className}
	maxWidth="max-w-md"
	{onsuccess}
	{...rest}
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
