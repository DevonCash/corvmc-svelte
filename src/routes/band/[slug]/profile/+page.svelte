<script lang="ts">
	import { IconDeviceFloppy, IconPlus, IconTrash } from '@tabler/icons-svelte';
	import { getProfile, getGenreSuggestions, saveProfile } from './data.remote';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import FreeformTagInput from '$lib/components/shared/FreeformTagInput.svelte';
	import type { DirectoryContact, ProfileLink } from '$lib/types/profile';

	let profile = $derived(await getProfile());
	let genreSuggestions = $derived(await getGenreSuggestions());

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

	<Form remote={saveProfile} successToast="Band profile saved">
		<PageHeader subtitle="Band Profile" title="Directory Profile">
			<SubmitButton shortcut="mod+s">
				{#snippet icon()}
					<IconDeviceFloppy size={20} />
				{/snippet}
			</SubmitButton>
		</PageHeader>
		<PageContent width="3xl">
		<input type="hidden" name="genres" value={JSON.stringify(genres)} />
		<input type="hidden" name="links" value={JSON.stringify(links)} />

		<div class="grid gap-6 lg:grid-cols-2 mb-6">
			<!-- Identity -->
			<InfoCard title="About">
				<div class="space-y-4">
					<FormField name="tagline" label="Tagline" type="text" value={profile?.tagline ?? ''} placeholder="e.g. Funk trio from Portland" description="A short one-liner shown on your directory card" />

					<FormField name="genres" label="Genres">
						<FreeformTagInput
							bind:value={genres}
							suggestions={genreSuggestions}
							placeholder="e.g. jazz, funk, rock..."
						/>
					</FormField>

					<FormField name="lookingForMembers" type="toggle" value={lookingForMembers} checkboxLabel="We're looking for members" />
				</div>
			</InfoCard>

			<!-- Links -->
			<InfoCard title="Links">
				<p class="text-sm opacity-60 mb-3">
					SoundCloud, YouTube, and Spotify links show as embedded players on your profile.
				</p>
				<div class="space-y-3">
					{#each links as link, i}
						<div class="flex gap-2 items-start">
							<div class="flex-1 space-y-1">
								<input
									type="text"
									value={link.label}
									oninput={(e) => updateLink(i, 'label', (e.target as HTMLInputElement).value)}
									placeholder="Label"
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
							<button
								type="button"
								class="btn btn-ghost btn-sm btn-square text-error mt-1"
								onclick={() => removeLink(i)}
							>
								<IconTrash size={16} />
							</button>
						</div>
					{/each}
					<button type="button" class="btn btn-outline btn-sm gap-1" onclick={addLink}>
						<IconPlus size={16} /> Add link
					</button>
				</div>
			</InfoCard>
		</div>

		<div class="grid gap-6 lg:grid-cols-2 mb-6">
			<!-- Contact -->
			<InfoCard title="Directory Contact Info">
				<p class="text-sm opacity-60 mb-3">
					Optional contact details shown on your directory listing.
				</p>
				<div class="space-y-3">
					<FormField name="contactEmail" label="Display email" type="email" value={contact.email ?? ''} placeholder="band@example.com" />
					<FormField name="contactPhone" label="Phone" type="tel" value={contact.phone ?? ''} />
					<FormField name="contactSocial" label="Social handle" type="text" value={contact.social ?? ''} placeholder="@handle or URL" />
				</div>
			</InfoCard>

			<!-- Visibility -->
			<InfoCard title="Visibility">
				<FormField name="directoryVisibility" label="Directory visibility">
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
								<p class="text-xs opacity-50">Anyone can see this band's profile, no login required</p>
							</div>
						</label>
					</div>
				</FormField>
			</InfoCard>
		</div>
		</PageContent>
	</Form>
