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
	import AvatarManager from '$lib/components/shared/AvatarManager.svelte';
	import RichTextEditor from '$lib/components/shared/Form/RichTextEditor.svelte';
	import LinkListEditor from '$lib/components/shared/Form/LinkListEditor.svelte';
	import VisibilityField from '$lib/components/shared/Form/VisibilityField.svelte';
	import FreeformTagInput from '$lib/components/shared/FreeformTagInput.svelte';
	import { updateBand, uploadBandAvatar, removeBandAvatar } from '$lib/remote/bands.remote';
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

	const bandFields = updateBand.fields;
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
</script>

<PageHeader title="Band Profile" subtitle={band.name} />
<PageContent width="3xl">
	<!-- Avatar -->
	<InfoCard title="Avatar">
		<AvatarManager
			uploadForm={uploadBandAvatar}
			removeForm={removeBandAvatar}
			currentUrl={band.avatarUrl}
			name={band.name}
		/>
	</InfoCard>

	<!-- Basics -->
	<InfoCard title="Basics">
		<Form
			remote={updateBand}
			guard
			onsuccess={() => {
				toast.success('Profile updated');
				const newSlug = updateBand.result?.slug;
				if (newSlug && newSlug !== band.slug) {
					goto(resolve(`/band/${newSlug}/edit`));
				} else {
					invalidateAll();
				}
			}}
			onfailure={() => toast.error('Failed to update')}
		>
			<div class="space-y-4">
				<FormField
					field={bandFields.name}
					type="text"
					label="Band Name"
					value={band.name}
					required
				/>

				<FormField field={bandFields.bio} label="Bio">
					<input {...bandFields.bio.as('hidden', bioHtml)} />
					<RichTextEditor bind:value={bioHtml} placeholder="Tell people about your band..." />
				</FormField>

				<div class="flex justify-end pt-2">
					<SubmitButton label="Save" successLabel="Saved" class="btn-primary" shortcut="mod+s">
						{#snippet icon()}<IconDeviceFloppy size={18} />{/snippet}
					</SubmitButton>
				</div>
			</div>
		</Form>
	</InfoCard>

	<!-- Directory -->
	<Form remote={saveBandProfile} guard onsuccess={() => toast.success('Directory profile saved')}>
		<input {...profileFields.genres.as('hidden', JSON.stringify(genres))} />

		<div class="mb-6 grid gap-6 lg:grid-cols-2">
			<InfoCard title="Directory Listing">
				<div class="space-y-4">
					<FormField
						field={profileFields.tagline}
						label="Tagline"
						type="text"
						value={profile?.tagline ?? ''}
						placeholder="e.g. Funk trio from Portland"
						description="A short one-liner shown on your directory card"
					/>

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

			<InfoCard title="Links">
				<p class="mb-3 text-sm opacity-60">
					SoundCloud, YouTube, and Spotify links show as embedded players on your profile.
				</p>
				<LinkListEditor bind:value={links} field={profileFields.links} />
			</InfoCard>
		</div>

		<div class="mb-6 grid gap-6 lg:grid-cols-2">
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

			<InfoCard title="Visibility">
				<VisibilityField
					field={profileFields.directoryVisibility}
					bind:value={directoryVisibility}
					publicDescription="Anyone can see this band's profile, no login required"
				/>
			</InfoCard>
		</div>

		<div class="flex justify-end">
			<SubmitButton label="Save Directory Profile" successLabel="Saved" class="btn-primary" />
		</div>
	</Form>
</PageContent>
