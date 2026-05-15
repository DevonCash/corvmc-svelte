<script lang="ts">
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import Modal from '$lib/components/shared/Modal.svelte';
	import { createAudienceCommand } from './data.remote';

	let { open = $bindable(false) }: { open: boolean } = $props();

	let name = $state('');
	let slug = $state('');
	let description = $state('');
	let allowOptIn = $state(false);
	let slugManuallyEdited = $state(false);
	let submitting = $state(false);

	// Auto-generate slug from name unless manually edited
	$effect(() => {
		if (!slugManuallyEdited && name) {
			slug = name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/-{2,}/g, '-')
				.replace(/^-|-$/g, '');
		}
	});

	async function handleSubmit() {
		if (!name.trim()) return;
		submitting = true;

		try {
			const result = await createAudienceCommand({
				name: name.trim(),
				slug: slug.trim() || undefined,
				description: description.trim() || undefined,
				allowOptIn
			});

			toast.success('Audience created');
			open = false;
			resetForm();

			if (result?.audienceId) {
				goto(`/staff/marketing/audiences/${result.audienceId}`);
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to create audience');
		} finally {
			submitting = false;
		}
	}

	function resetForm() {
		name = '';
		slug = '';
		description = '';
		allowOptIn = false;
		slugManuallyEdited = false;
	}
</script>

<Modal bind:open title="New Audience" maxWidth="max-w-md" onclose={resetForm}>
	<form
		onsubmit={(e) => {
			e.preventDefault();
			handleSubmit();
		}}
		class="space-y-4"
	>
		<fieldset class="fieldset">
			<legend class="fieldset-legend">Name</legend>
			<input
				type="text"
				bind:value={name}
				placeholder="e.g. Newsletter"
				class="input-bordered input w-full"
				required
			/>
		</fieldset>

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

		<fieldset class="fieldset">
			<legend class="fieldset-legend">Description</legend>
			<textarea
				bind:value={description}
				placeholder="Optional description shown on the signup page..."
				class="textarea-bordered textarea w-full"
				rows="2"
			></textarea>
		</fieldset>

		<label class="label cursor-pointer justify-start gap-3">
			<input type="checkbox" class="checkbox checkbox-sm" bind:checked={allowOptIn} />
			<div>
				<span class="text-sm font-medium">Allow opt-in</span>
				<p class="text-xs opacity-60">Show on public subscribe page and member account</p>
			</div>
		</label>

		<div class="modal-action">
			<button type="button" class="btn btn-ghost" onclick={() => (open = false)}>Cancel</button>
			<button
				type="submit"
				class="btn btn-primary"
				disabled={!name.trim() || submitting}
			>
				{#if submitting}
					<span class="loading loading-sm loading-spinner"></span>
				{/if}
				Create Audience
			</button>
		</div>
	</form>
</Modal>
