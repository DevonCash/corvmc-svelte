<script lang="ts">
	import { IconDeviceFloppy, IconPlus, IconTrash } from '@tabler/icons-svelte';
	import {
		getMemberProfile,
		getInstrumentSuggestions,
		getGenreSuggestions,
		saveMemberProfile
	} from '$lib/remote/directory.remote';

	const { fields } = saveMemberProfile;
	import Form from '$lib/components/shared/Form/Form.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import FreeformTagInput from '$lib/components/shared/FreeformTagInput.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import { toast } from 'svelte-sonner';
	import type { DirectoryContact, ProfileLink } from '$lib/server/db/schema/authentication';

	let profile = $derived(await getMemberProfile());
	let instrumentSuggestions = $derived(await getInstrumentSuggestions());
	let genreSuggestions = $derived(await getGenreSuggestions());

	// Local state for complex fields
	let instruments = $state<string[]>([]);
	let genres = $state<string[]>([]);
	let links = $state<ProfileLink[]>([]);
	let lookingForBand = $state(false);
	let directoryVisibility = $state<string>('members');

	// Sync from loaded profile
	$effect(() => {
		if (profile) {
			instruments = profile.instruments ?? [];
			genres = profile.genres ?? [];
			links = (profile.links as ProfileLink[] | null) ?? [];
			lookingForBand = profile.lookingForBand;
			directoryVisibility = profile.directoryVisibility;
		}
	});

	let contact = $derived((profile?.directoryContact as DirectoryContact | null) ?? {});

	function addLink() {
		links = [...links, { label: '', url: '' }];
	}

	function removeLink(index: number) {
		links = links.filter((_, i) => i !== index);
	}

	function updateLink(index: number, field: 'label' | 'url', value: string) {
		links = links.map((l, i) => (i === index ? { ...l, [field]: value } : l));
	}
</script>

	<Form remote={saveMemberProfile} onsuccess={() => toast.success('Profile saved')}>
		<PageHeader subtitle="Profile" title="My Profile">
			<SubmitButton shortcut="mod+s">
				{#snippet icon()}
					<IconDeviceFloppy size={20} />
				{/snippet}
			</SubmitButton>
		</PageHeader>
		<PageContent width="3xl">
		<!-- Hidden fields for complex data -->
		<input {...fields.instruments.as('hidden', JSON.stringify(instruments))} />
		<input {...fields.genres.as('hidden', JSON.stringify(genres))} />
		<input {...fields.links.as('hidden', JSON.stringify(links))} />

		<div class="grid gap-6 lg:grid-cols-2 mb-6">
			<!-- Identity & About -->
			<InfoCard title="About You">
				<div class="space-y-4">
					<FormField field={fields.tagline} label="Tagline" type="text" value={profile?.tagline ?? ''} placeholder="e.g. Drummer | Jazz & Funk" description="A short one-liner shown on your directory card" />
					<FormField field={fields.bio} label="Bio" type="textarea" value={profile?.bio ?? ''} placeholder="Tell other members about yourself..." />
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

					<FormField field={fields.lookingForBand} type="toggle" value={lookingForBand} checkboxLabel="I'm looking for a band" />
				</div>
			</InfoCard>
		</div>

		<div class="grid gap-6 lg:grid-cols-2 mb-6">
			<!-- Links -->
			<InfoCard title="Links">
				<p class="text-sm opacity-60 mb-3">
					Add links to your music, social media, or personal site. SoundCloud, YouTube,
					and Spotify links will show as embedded players on your profile.
				</p>
				<div class="space-y-3">
					{#each links as link, i}
						<div class="flex gap-2 items-start">
							<div class="flex-1 space-y-1">
								<input
									type="text"
									value={link.label}
									oninput={(e) => updateLink(i, 'label', (e.target as HTMLInputElement).value)}
									placeholder="Label (e.g. My SoundCloud)"
									class="input-bordered input input-sm w-full"
								/>
								<input
									type="url"
									value={link.url}
									oninput={(e) => updateLink(i, 'url', (e.target as HTMLInputElement).value)}
									placeholder="https://..."
									class="input-bordered input input-sm w-full"
								/>
							</div>
							<Button
								type="button"
								class="btn-ghost btn-sm btn-square text-error mt-1"
								onclick={() => removeLink(i)}
							>
								<IconTrash size={16} />
							</Button>
						</div>
					{/each}
					<Button type="button" class="btn-outline btn-sm gap-1" onclick={addLink}>
						<IconPlus size={16} /> Add link
					</Button>
				</div>
			</InfoCard>

			<!-- Contact & Visibility -->
			<div class="space-y-6">
				<InfoCard title="Directory Contact Info">
					<p class="text-sm opacity-60 mb-3">
						Optional contact details shown on your directory profile.
						Leave blank to keep private.
					</p>
					<div class="space-y-3">
						<FormField field={fields.contactEmail} label="Display email" type="email" value={contact.email ?? ''} placeholder="you@example.com" />
						<FormField field={fields.contactPhone} label="Phone" type="tel" value={contact.phone ?? ''} placeholder="Optional" />
						<FormField field={fields.contactSocial} label="Social handle" type="text" value={contact.social ?? ''} placeholder="@handle or URL" />
					</div>
				</InfoCard>

				<InfoCard title="Visibility">
					<FormField field={fields.directoryVisibility} label="Directory visibility">
						<div class="space-y-2">
							<label class="label cursor-pointer justify-start gap-3">
								<input type="radio" name="directoryVisibility" value="hidden" class="radio" checked={directoryVisibility === 'hidden'} onchange={() => (directoryVisibility = 'hidden')} />
								<div>
									<p>Hidden</p>
									<p class="text-xs opacity-50">Not shown in any directory</p>
								</div>
							</label>
							<label class="label cursor-pointer justify-start gap-3">
								<input type="radio" name="directoryVisibility" value="members" class="radio" checked={directoryVisibility === 'members'} onchange={() => (directoryVisibility = 'members')} />
								<div>
									<p>Members only</p>
									<p class="text-xs opacity-50">Visible to logged-in members</p>
								</div>
							</label>
							<label class="label cursor-pointer justify-start gap-3">
								<input type="radio" name="directoryVisibility" value="public" class="radio" checked={directoryVisibility === 'public'} onchange={() => (directoryVisibility = 'public')} />
								<div>
									<p>Public</p>
									<p class="text-xs opacity-50">Anyone can see your profile, no login required</p>
								</div>
							</label>
						</div>
					</FormField>
				</InfoCard>
			</div>
		</div>
		</PageContent>
	</Form>
