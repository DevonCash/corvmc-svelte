<script lang="ts">
	import { IconDeviceFloppy, IconPlus, IconTrash } from '@tabler/icons-svelte';
	import {
		getProfile,
		getInstrumentSuggestions,
		getGenreSuggestions,
		saveProfile
	} from './data.remote';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import FreeformTagInput from '$lib/components/shared/FreeformTagInput.svelte';
	import type { DirectoryContact, ProfileLink } from '$lib/types/profile';

	let profile = $derived(await getProfile());
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

<svelte:boundary>
	<Form remote={saveProfile} successToast="Profile saved">
		<PageHeader subtitle="Profile" title="My Profile">
			<SubmitButton shortcut="mod+s">
				{#snippet icon()}
					<IconDeviceFloppy size={20} />
				{/snippet}
			</SubmitButton>
		</PageHeader>

		<!-- Hidden fields for complex data -->
		<input type="hidden" name="instruments" value={JSON.stringify(instruments)} />
		<input type="hidden" name="genres" value={JSON.stringify(genres)} />
		<input type="hidden" name="links" value={JSON.stringify(links)} />

		<div class="grid gap-6 lg:grid-cols-2 mb-6">
			<!-- Identity & About -->
			<InfoCard title="About You">
				<div class="space-y-4">
					<fieldset class="fieldset">
						<legend class="fieldset-legend">Tagline</legend>
						<input
							name="tagline"
							type="text"
							value={profile?.tagline ?? ''}
							placeholder="e.g. Drummer | Jazz & Funk"
							maxlength="150"
							class="input-bordered input w-full"
						/>
						<p class="text-xs opacity-50 mt-1">A short one-liner shown on your directory card</p>
					</fieldset>

					<fieldset class="fieldset">
						<legend class="fieldset-legend">Bio</legend>
						<textarea
							name="bio"
							rows="4"
							placeholder="Tell other members about yourself..."
							maxlength="2000"
							class="textarea-bordered textarea w-full"
						>{profile?.bio ?? ''}</textarea>
					</fieldset>
				</div>
			</InfoCard>

			<!-- Music -->
			<InfoCard title="Music">
				<div class="space-y-4">
					<fieldset class="fieldset">
						<legend class="fieldset-legend">Instruments</legend>
						<FreeformTagInput
							bind:value={instruments}
							suggestions={instrumentSuggestions}
							placeholder="e.g. guitar, vocals, drums..."
						/>
					</fieldset>

					<fieldset class="fieldset">
						<legend class="fieldset-legend">Genres</legend>
						<FreeformTagInput
							bind:value={genres}
							suggestions={genreSuggestions}
							placeholder="e.g. jazz, funk, rock..."
						/>
					</fieldset>

					<label class="label cursor-pointer justify-start gap-3">
						<input
							type="checkbox"
							name="lookingForBand"
							class="toggle toggle-primary"
							checked={lookingForBand}
							onchange={(e) => (lookingForBand = (e.target as HTMLInputElement).checked)}
						/>
						<span>I'm looking for a band</span>
					</label>
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

			<!-- Contact & Visibility -->
			<div class="space-y-6">
				<InfoCard title="Directory Contact Info">
					<p class="text-sm opacity-60 mb-3">
						Optional contact details shown on your directory profile.
						Leave blank to keep private.
					</p>
					<div class="space-y-3">
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Display email</legend>
							<input
								name="contactEmail"
								type="email"
								value={contact.email ?? ''}
								placeholder="you@example.com"
								class="input-bordered input w-full"
							/>
						</fieldset>
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Phone</legend>
							<input
								name="contactPhone"
								type="tel"
								value={contact.phone ?? ''}
								placeholder="Optional"
								class="input-bordered input w-full"
							/>
						</fieldset>
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Social handle</legend>
							<input
								name="contactSocial"
								type="text"
								value={contact.social ?? ''}
								placeholder="@handle or URL"
								class="input-bordered input w-full"
							/>
						</fieldset>
					</div>
				</InfoCard>

				<InfoCard title="Visibility">
					<div class="space-y-2">
						<label class="label cursor-pointer justify-start gap-3">
							<input
								type="radio"
								name="directoryVisibility"
								value="hidden"
								class="radio"
								checked={directoryVisibility === 'hidden'}
								onchange={() => (directoryVisibility = 'hidden')}
							/>
							<div>
								<p>Hidden</p>
								<p class="text-xs opacity-50">Not shown in any directory</p>
							</div>
						</label>
						<label class="label cursor-pointer justify-start gap-3">
							<input
								type="radio"
								name="directoryVisibility"
								value="members"
								class="radio"
								checked={directoryVisibility === 'members'}
								onchange={() => (directoryVisibility = 'members')}
							/>
							<div>
								<p>Members only</p>
								<p class="text-xs opacity-50">Visible to logged-in members</p>
							</div>
						</label>
						<label class="label cursor-pointer justify-start gap-3">
							<input
								type="radio"
								name="directoryVisibility"
								value="public"
								class="radio"
								checked={directoryVisibility === 'public'}
								onchange={() => (directoryVisibility = 'public')}
							/>
							<div>
								<p>Public</p>
								<p class="text-xs opacity-50">Anyone can see your profile, no login required</p>
							</div>
						</label>
					</div>
				</InfoCard>
			</div>
		</div>
	</Form>

	{#snippet pending()}
		<div class="flex items-center justify-center p-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{/snippet}

	{#snippet failed(error, reset)}
		<div class="alert alert-error">
			<p>Failed to load profile: {String(error)}</p>
			<button class="btn btn-sm" onclick={reset}>Retry</button>
		</div>
	{/snippet}
</svelte:boundary>
