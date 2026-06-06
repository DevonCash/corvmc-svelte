<script lang="ts">
	import { IconDeviceFloppy } from '@tabler/icons-svelte';
	import {
		getMemberProfile,
		getInstrumentSuggestions,
		getGenreSuggestions,
		saveMemberProfile,
		uploadMemberAvatar,
		removeMemberAvatar
	} from '$lib/remote/directory.remote';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import AvatarManager from '$lib/components/shared/AvatarManager.svelte';
	import FreeformTagInput from '$lib/components/shared/FreeformTagInput.svelte';
	import RichTextEditor from '$lib/components/shared/Form/RichTextEditor.svelte';
	import LinkListEditor from '$lib/components/shared/Form/LinkListEditor.svelte';
	import VisibilityField from '$lib/components/shared/Form/VisibilityField.svelte';
	import { toast } from 'svelte-sonner';
	import type { DirectoryContact, ProfileLink } from '$lib/server/db/schema/authentication';

	let profile = $derived(await getMemberProfile());
	let instrumentSuggestions = $derived(await getInstrumentSuggestions());
	let genreSuggestions = $derived(await getGenreSuggestions());

	const { fields } = saveMemberProfile;

	// Local state for complex fields
	let bioHtml = $state('');
	let instruments = $state<string[]>([]);
	let genres = $state<string[]>([]);
	let links = $state<ProfileLink[]>([]);
	let lookingForBand = $state(false);
	let availableForHire = $state(false);
	let teachesLessons = $state(false);
	let openToCollaboration = $state(false);
	let directoryVisibility = $state<string>('members');

	$effect(() => {
		if (profile) {
			bioHtml = profile.bio ?? '';
			instruments = profile.instruments ?? [];
			genres = profile.genres ?? [];
			links = (profile.links as ProfileLink[] | null) ?? [];
			lookingForBand = profile.lookingForBand;
			availableForHire = profile.availableForHire;
			teachesLessons = profile.teachesLessons;
			openToCollaboration = profile.openToCollaboration;
			directoryVisibility = profile.directoryVisibility;
		}
	});

	let contact = $derived((profile?.directoryContact as DirectoryContact | null) ?? {});
</script>

<PageHeader subtitle="Profile" title="My Profile" />
<PageContent width="3xl">
	<!-- Avatar -->
	<InfoCard title="Photo">
		<AvatarManager
			uploadForm={uploadMemberAvatar}
			removeForm={removeMemberAvatar}
			currentUrl={profile?.avatarUrl ?? null}
			name={profile?.name ?? ''}
		/>
	</InfoCard>

	<Form remote={saveMemberProfile} guard onsuccess={() => toast.success('Profile saved')}>
		<!-- Hidden fields for complex data (links renders its own via LinkListEditor) -->
		<input {...fields.instruments.as('hidden', JSON.stringify(instruments))} />
		<input {...fields.genres.as('hidden', JSON.stringify(genres))} />

		<div class="mb-6 grid gap-6 lg:grid-cols-2">
			<!-- Identity & About -->
			<InfoCard title="About You">
				<div class="space-y-4">
					<FormField
						field={fields.tagline}
						label="Tagline"
						type="text"
						value={profile?.tagline ?? ''}
						placeholder="e.g. Drummer | Jazz & Funk"
						description="A short one-liner shown on your directory card"
					/>
					<FormField field={fields.bio} label="Bio">
						<input {...fields.bio.as('hidden', bioHtml)} />
						<RichTextEditor
							bind:value={bioHtml}
							placeholder="Tell other members about yourself..."
						/>
					</FormField>
				</div>
			</InfoCard>

			<!-- Music -->
			<InfoCard title="Music">
				<div class="space-y-4">
					<FormField field={fields.instruments} label="Instruments">
						<FreeformTagInput
							bind:value={instruments}
							suggestions={instrumentSuggestions}
							placeholder="e.g. guitar, vocals, drums..."
						/>
					</FormField>

					<FormField field={fields.genres} label="Genres">
						<FreeformTagInput
							bind:value={genres}
							suggestions={genreSuggestions}
							placeholder="e.g. jazz, funk, rock..."
						/>
					</FormField>

					<FormField
						field={fields.lookingForBand}
						type="toggle"
						value={lookingForBand}
						checkboxLabel="I'm looking for a band"
					/>
					<FormField
						field={fields.availableForHire}
						type="toggle"
						value={availableForHire}
						checkboxLabel="I'm available for hire"
					/>
					<FormField
						field={fields.teachesLessons}
						type="toggle"
						value={teachesLessons}
						checkboxLabel="I teach lessons"
					/>
					<FormField
						field={fields.openToCollaboration}
						type="toggle"
						value={openToCollaboration}
						checkboxLabel="I'm open to collaboration"
					/>
				</div>
			</InfoCard>
		</div>

		<div class="mb-6 grid gap-6 lg:grid-cols-2">
			<!-- Links -->
			<InfoCard title="Links">
				<p class="mb-3 text-sm opacity-60">
					Add links to your music, social media, or personal site. SoundCloud, YouTube, and Spotify
					links will show as embedded players on your profile.
				</p>
				<LinkListEditor bind:value={links} field={fields.links} />
			</InfoCard>

			<!-- Contact & Visibility -->
			<div class="space-y-6">
				<InfoCard title="Directory Contact Info">
					<p class="mb-3 text-sm opacity-60">
						Optional contact details shown on your directory profile. Leave blank to keep private.
					</p>
					<div class="space-y-3">
						<FormField
							field={fields.contactEmail}
							label="Display email"
							type="email"
							value={contact.email ?? ''}
							placeholder="you@example.com"
						/>
						<FormField
							field={fields.contactPhone}
							label="Phone"
							type="tel"
							value={contact.phone ?? ''}
							placeholder="Optional"
						/>
						<FormField
							field={fields.contactSocial}
							label="Social handle"
							type="text"
							value={contact.social ?? ''}
							placeholder="@handle or URL"
						/>
					</div>
				</InfoCard>

				<InfoCard title="Visibility">
					<VisibilityField field={fields.directoryVisibility} bind:value={directoryVisibility} />
				</InfoCard>
			</div>
		</div>

		<div class="flex justify-end">
			<SubmitButton label="Save" successLabel="Saved" class="btn-primary" shortcut="mod+s">
				{#snippet icon()}<IconDeviceFloppy size={18} />{/snippet}
			</SubmitButton>
		</div>
	</Form>
</PageContent>
