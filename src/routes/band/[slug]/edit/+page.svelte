<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { updateBand } from './data.remote';
	import type { BandLayoutResponse } from '$lib/types/api';

	let { data }: { data: BandLayoutResponse } = $props();

	const band = $derived(data.band);

	const initial = $derived({
		name: band.name,
		bio: band.bio ?? ''
	});

	// Avatar state
	let avatarUploading = $state(false);
	let avatarError = $state('');

	async function handleAvatarUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		avatarUploading = true;
		avatarError = '';

		try {
			const formData = new FormData();
			formData.append('file', file);

			const res = await fetch(`/api/bands/${band.id}/avatar`, {
				method: 'POST',
				body: formData
			});

			if (!res.ok) {
				const body = await res.json();
				throw new Error(body.error ?? 'Upload failed');
			}

			await invalidateAll();
		} catch (err) {
			avatarError = (err as Error).message;
		} finally {
			avatarUploading = false;
			input.value = '';
		}
	}

	async function handleAvatarRemove() {
		avatarUploading = true;
		avatarError = '';

		try {
			const res = await fetch(`/api/bands/${band.id}/avatar`, {
				method: 'DELETE'
			});

			if (!res.ok) {
				const body = await res.json();
				throw new Error(body.error ?? 'Failed to remove avatar');
			}

			await invalidateAll();
		} catch (err) {
			avatarError = (err as Error).message;
		} finally {
			avatarUploading = false;
		}
	}
</script>

<div class="max-w-md space-y-6">
	<PageHeader title="Edit Profile" subtitle={band.name} />

	<!-- Avatar -->
	<div class="space-y-2">
		<p class="text-sm font-medium">Avatar</p>
		<div class="flex items-center gap-4">
			<div class="avatar placeholder">
				<div class="bg-neutral text-neutral-content w-16 rounded-full">
					{#if band.avatarKey}
						<span class="text-2xl">✓</span>
					{:else}
						<span class="text-2xl">{band.name.charAt(0).toUpperCase()}</span>
					{/if}
				</div>
			</div>
			<div class="flex flex-col gap-1">
				<label class="btn btn-sm btn-outline" class:loading={avatarUploading}>
					{avatarUploading ? 'Uploading...' : 'Upload Photo'}
					<input
						type="file"
						accept="image/jpeg,image/png,image/webp"
						class="hidden"
						onchange={handleAvatarUpload}
						disabled={avatarUploading}
					/>
				</label>
				{#if band.avatarKey}
					<button
						class="btn btn-sm btn-ghost text-error"
						onclick={handleAvatarRemove}
						disabled={avatarUploading}
					>
						Remove
					</button>
				{/if}
			</div>
		</div>
		{#if avatarError}
			<p class="text-error text-sm">{avatarError}</p>
		{/if}
	</div>

	<!-- Band details form -->
	<Form
		remote={updateBand}
		successToast="Profile updated"
		errorToast="Failed to update"
		onsuccess={() => {
			const newSlug = updateBand.result?.slug;
			if (newSlug && newSlug !== band.slug) {
				goto(`/band/${newSlug}/edit`);
			} else {
				invalidateAll();
			}
		}}
	>
		<div class="space-y-4">
			<FormField label="Band Name" id="band-name">
				<input
					id="band-name"
					name="name"
					type="text"
					class="input input-bordered w-full"
					value={initial.name}
					required
				/>
			</FormField>

			<FormField label="Bio" id="band-bio">
				<textarea
					id="band-bio"
					name="bio"
					class="textarea textarea-bordered w-full"
					rows="4"
					placeholder="Tell people about your band..."
					value={initial.bio}
				></textarea>
			</FormField>

			<div class="flex justify-end pt-2">
				<SubmitButton label="Save Changes" successLabel="Saved" class="btn-primary" />
			</div>
		</div>
	</Form>
</div>
