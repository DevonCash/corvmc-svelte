<script lang="ts">
	import { IconDeviceFloppy } from '@tabler/icons-svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { page } from '$app/state';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import RichTextEditor from '$lib/components/shared/Form/RichTextEditor.svelte';
	import LinkListEditor from '$lib/components/shared/Form/LinkListEditor.svelte';
	import VisibilityField from '$lib/components/shared/Form/VisibilityField.svelte';
	import FreeformTagInput from '$lib/components/shared/FreeformTagInput.svelte';
	import {
		getBandProfile,
		getGenreSuggestions,
		saveBandProfile
	} from '$lib/remote/directory.remote';
	import { getBandLayout } from '$lib/remote/layout.remote';
	import type { DirectoryContact, ProfileLink } from '$lib/server/db/schema/authentication';

	let layout = $derived(await getBandLayout(page.params.slug!));
	let profile = $derived(await getBandProfile());
	let genreSuggestions = $derived(await getGenreSuggestions());

	const band = $derived(layout.band);

	const profileFields = saveBandProfile.fields;

	// Basics
	let bioHtml = $derived(band.bio ?? '');
	// Directory
	let genres = $state<string[]>([]);
	let links = $state<ProfileLink[]>([]);
	let lookingForMembers = $state(false);
	let directoryVisibility = $state<string>('public');

	$effect(() => {
		if (profile) {
			genres = profile.genres ?? [];
			links = (profile.links as ProfileLink[] | null) ?? [];
			lookingForMembers = profile.lookingForMembers;
			directoryVisibility = profile.directoryVisibility;
		}
	});

	let contact = $derived((profile?.directoryContact as DirectoryContact | null) ?? {});

	// Avatar uploads instantly through the band-avatar API route, which persists
	// the new key and returns it (the value is also submitted with the form).
	async function uploadAvatar(file: File): Promise<string> {
		const fd = new FormData();
		fd.set('file', file);
		const res = await fetch(`/api/bands/${band.id}/avatar`, { method: 'POST', body: fd });
		if (!res.ok) {
			const err = (await res.json().catch(() => ({}))) as { message?: string };
			throw new Error(err.message || 'Upload failed');
		}
		const data = (await res.json()) as { avatarKey: string };
		invalidateAll();
		return data.avatarKey;
	}
</script>

<PageHeader title="Band Profile" subtitle={band.name} />
<PageContent width="3xl">
	<Form
		remote={saveBandProfile}
		guard
		onsuccess={() => {
			toast.success('Profile saved');
			const newSlug = saveBandProfile.result?.slug;
			if (newSlug && newSlug !== band.slug) {
				goto(resolve(`/band/${newSlug}/edit`));
			} else {
				invalidateAll();
			}
		}}
		onfailure={() => toast.error('Failed to save')}
	>
		<input {...profileFields.genres.as('hidden', JSON.stringify(genres))} />

		<!-- Basics -->
		<InfoCard title="Basics">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-start">
				<div class="flex-1 space-y-4">
					<FormField
						field={profileFields.name}
						type="text"
						label="Band Name"
						value={band.name}
						required
					/>

					<FormField
						field={profileFields.tagline}
						label="Tagline"
						type="text"
						value={profile?.tagline ?? ''}
						placeholder="e.g. Funk trio from Portland"
						description="A short one-liner shown on your directory card"
					/>
				</div>

				<FormField
					label="Avatar"
					name="avatarKey"
					type="file"
					upload={uploadAvatar}
					accept="image/jpeg,image/png,image/webp"
					src={band.avatarUrl ?? undefined}
					orientation="col"
					class="shrink-0"
				/>
			</div>

			<div class="mt-4 space-y-4">
				<FormField field={profileFields.bio} label="Bio">
					<input {...profileFields.bio.as('hidden', bioHtml)} />
					<RichTextEditor bind:value={bioHtml} placeholder="Tell people about your band..." />
				</FormField>

				<FormField field={profileFields.genres} label="Genres">
					<FreeformTagInput
						bind:value={genres}
						suggestions={genreSuggestions}
						placeholder="e.g. jazz, funk, rock..."
					/>
				</FormField>

				<FormField
					field={profileFields.lookingForMembers}
					type="toggle"
					value={lookingForMembers}
					checkboxLabel="We're looking for members"
				/>
			</div>
		</InfoCard>

		<div class="mb-6 grid gap-6 lg:grid-cols-2">
			<InfoCard title="Links">
				<p class="mb-3 text-sm opacity-60">
					SoundCloud, YouTube, and Spotify links show as embedded players on your profile.
				</p>
				<LinkListEditor bind:value={links} field={profileFields.links} />
			</InfoCard>

			<InfoCard title="Directory Contact Info">
				<p class="mb-3 text-sm opacity-60">
					Optional contact details shown on your directory listing.
				</p>
				<div class="space-y-3">
					<FormField
						field={profileFields.contactEmail}
						label="Display email"
						type="email"
						value={contact.email ?? ''}
						placeholder="band@example.com"
					/>
					<FormField
						field={profileFields.contactPhone}
						label="Phone"
						type="tel"
						value={contact.phone ?? ''}
					/>
					<FormField
						field={profileFields.contactSocial}
						label="Social handle"
						type="text"
						value={contact.social ?? ''}
						placeholder="@handle or URL"
					/>
				</div>
			</InfoCard>
		</div>

		<div class="mb-6">
			<InfoCard title="Visibility">
				<VisibilityField
					field={profileFields.directoryVisibility}
					bind:value={directoryVisibility}
					publicDescription="Anyone can see this band's profile, no login required"
				/>
			</InfoCard>
		</div>

		<div class="flex justify-end">
			<SubmitButton label="Save" successLabel="Saved" class="btn-primary" shortcut="mod+s">
				{#snippet icon()}<IconDeviceFloppy size={18} />{/snippet}
			</SubmitButton>
		</div>
	</Form>
</PageContent>
