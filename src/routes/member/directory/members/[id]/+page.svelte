<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { getDirectoryMember } from '$lib/remote/directory.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import ProfileLinks from '$lib/components/shared/directory/ProfileLinks.svelte';
	import ProfileEmbeds from '$lib/components/shared/directory/ProfileEmbeds.svelte';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import type { DirectoryContact, ProfileLink } from '$lib/server/db/schema/authentication';
	import Alert from '$lib/components/shared/Alert.svelte';
	import { hashPattern } from '$lib/utils/patterns';
	import { sanitizeBio } from '$lib/utils/markdown';
	import speakerLogo from '$lib/assets/cmc-speaker-icon.svg';
	import { IconMail, IconPhone, IconAt } from '@tabler/icons-svelte';

	let id = $derived(page.params.id!);
	let member = $derived(await getDirectoryMember(id));

	let links = $derived((member?.links as ProfileLink[] | null) ?? []);
	let contact = $derived((member?.directoryContact as DirectoryContact | null) ?? {});
	let hasContact = $derived(!!contact.email || !!contact.phone || !!contact.social);
	let patternClass = $derived(member ? `poster-gen--${hashPattern(member.name)}` : '');
	let memberSince = $derived(member ? new Date(member.createdAt).getFullYear() : null);
</script>

{#if member}
	<PageHeader title={member.name} subtitle="Member Profile" backHref="/member/directory" />
	<PageContent width="3xl">
		<!-- Profile Card -->
		<div class="profile-card">
			<!-- Card Header with brand stripe -->
			<div class="profile-card__header">
				<div class="profile-card__brand">
					<img src={speakerLogo} alt="" class="profile-card__logo" />
					<span>Corvallis Music Collective</span>
				</div>
				<div class="profile-card__tag">MEMBER</div>
			</div>

			<!-- Pattern banner + avatar -->
			<div class="profile-card__banner poster-gen {patternClass}">
				{#if member.lookingForBand}
					<div class="profile-card__gaff">seeking a band</div>
				{/if}
			</div>

			<div class="profile-card__body">
				<div class="profile-card__avatar-row">
					<Avatar
						class="-mt-14 size-24 border-4 border-base-100"
						src={member.image ?? undefined}
						name={member.name}
					/>
					<div class="profile-card__identity">
						<h2 class="profile-card__name">
							{member.name}
							{#if member.pronouns}
								<span class="profile-card__pronouns">{member.pronouns}</span>
							{/if}
						</h2>
						{#if member.tagline}
							<p class="profile-card__tagline">{member.tagline}</p>
						{/if}
					</div>
				</div>

				{#if member.bio}
					<div class="profile-card__bio prose prose-sm max-w-none">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted/sanitized HTML (markdown bio) -->
						{@html sanitizeBio(member.bio)}
					</div>
				{/if}

				{#if member.instruments?.length || member.genres?.length}
					<div class="profile-card__tags">
						{#if member.instruments?.length}
							<div>
								<p class="sl">Instruments</p>
								<div class="profile-card__badge-row">
									{#each member.instruments as inst (inst)}
										<span class="sticker-badge sticker-badge--teal sticker-badge--sm">{inst}</span>
									{/each}
								</div>
							</div>
						{/if}
						{#if member.genres?.length}
							<div>
								<p class="sl">Genres</p>
								<div class="profile-card__badge-row">
									{#each member.genres as genre (genre)}
										<span class="sticker-badge sticker-badge--sm">{genre}</span>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}

				{#if member.bands?.length}
					<div>
						<p class="sl">Bands</p>
						<div class="profile-card__badge-row">
							{#each member.bands as b (b.slug)}
								<a
									href={resolve('/member/directory/bands/[slug]', { slug: b.slug })}
									class="sticker-badge sticker-badge--orange sticker-badge--sm">{b.name}</a
								>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			{#if hasContact}
				<div class="profile-card__contact">
					{#if contact.email}
						<a href="mailto:{contact.email}" class="profile-card__contact-item">
							<IconMail size={16} />
							<span>{contact.email}</span>
						</a>
					{/if}
					{#if contact.phone}
						<a href="tel:{contact.phone}" class="profile-card__contact-item">
							<IconPhone size={16} />
							<span>{contact.phone}</span>
						</a>
					{/if}
					{#if contact.social}
						<span class="profile-card__contact-item">
							<IconAt size={16} />
							<span>{contact.social}</span>
						</span>
					{/if}
				</div>
			{/if}

			{#if memberSince}
				<div class="profile-card__footer">
					<span class="profile-card__since">Member since {memberSince}</span>
					<div class="profile-card__barcode" aria-hidden="true"></div>
				</div>
			{/if}
		</div>

		{#if links.length > 0}
			<div>
				<p class="sl">Links</p>
				<ProfileLinks {links} />
			</div>
		{/if}

		{#if links.length > 0}
			<ProfileEmbeds {links} />
		{/if}
	</PageContent>
{:else}
	<Alert type="warning">
		Member not found or profile is hidden.
		{#snippet action()}
			<Button href="/member/directory" class="btn-sm">Back to Directory</Button>
		{/snippet}
	</Alert>
{/if}

<style>
	.profile-card {
		background: var(--bg-card, var(--color-base-200));
		border: 2.5px solid var(--cmc-brown);
		border-radius: 12px;
		overflow: hidden;
	}

	.profile-card__header {
		padding: 12px 20px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		position: relative;
	}
	.profile-card__header::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 6px;
		background: linear-gradient(
			to bottom,
			var(--cmc-teal) 0 33.333%,
			var(--cmc-goldenrod) 33.333% 66.666%,
			var(--cmc-red-orange) 66.666% 100%
		);
	}
	.profile-card__brand {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 700;
		font-size: 12px;
		letter-spacing: 0.02em;
		color: var(--cmc-teal);
	}
	.profile-card__logo {
		height: 24px;
		width: auto;
		object-fit: contain;
	}
	.profile-card__tag {
		font-weight: 700;
		font-size: 10px;
		letter-spacing: 0.16em;
		color: var(--cmc-teal);
		padding: 4px 10px;
		border: 1.5px solid var(--cmc-teal);
		border-radius: 3px;
	}

	.profile-card__banner {
		height: 120px;
		position: relative;
	}
	.profile-card__gaff {
		position: absolute;
		padding: 4px 14px;
		background: var(--color-primary);
		color: var(--color-primary-content);
		font-weight: 700;
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		transform: rotate(-2deg);
		z-index: 2;
		top: 16px;
		right: -4px;
	}

	.profile-card__body {
		padding: 0 24px 20px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.profile-card__avatar-row {
		display: flex;
		align-items: flex-end;
		gap: 16px;
	}
	.profile-card__identity {
		padding-bottom: 4px;
	}
	.profile-card__name {
		font-weight: 700;
		font-size: 24px;
		line-height: 1.15;
		color: var(--color-secondary);
	}
	.profile-card__pronouns {
		font-weight: 400;
		font-size: 14px;
		color: var(--fg-3);
		margin-left: 6px;
	}
	.profile-card__tagline {
		font-size: 14px;
		color: var(--fg-2);
		margin-top: 2px;
	}
	.profile-card__bio {
		font-size: 14.5px;
		line-height: 1.65;
		color: var(--fg-1);
		max-width: 62ch;
		text-wrap: pretty;
	}
	.profile-card__tags {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.profile-card__badge-row {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.profile-card__contact {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		border-top: 2.5px solid var(--cmc-brown);
		margin: 0 -1px;
	}
	.profile-card__contact-item {
		flex: 1;
		min-width: 160px;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 20px;
		font-size: 13px;
		font-weight: 500;
		color: var(--fg-1);
		border-right: 2.5px solid var(--cmc-brown);
		text-decoration: none;
	}
	.profile-card__contact-item:last-child {
		border-right: 0;
	}
	.profile-card__contact-item:hover {
		background: color-mix(in oklch, var(--cmc-teal) 8%, transparent);
	}

	.profile-card__footer {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		padding: 8px 20px 12px;
		border-top: 1px solid color-mix(in oklch, var(--cmc-brown) 18%, transparent);
	}
	.profile-card__since {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--fg-3);
		white-space: nowrap;
	}
	.profile-card__barcode {
		flex: 1;
		max-width: 120px;
		height: 16px;
		opacity: 0.25;
		background: repeating-linear-gradient(
			to right,
			currentColor 0 1px,
			transparent 1px 2.5px,
			currentColor 2.5px 3px,
			transparent 3px 5px,
			currentColor 5px 5.5px,
			transparent 5.5px 8px,
			currentColor 8px 10px,
			transparent 10px 11px,
			currentColor 11px 11.5px,
			transparent 11.5px 13px
		);
	}

	@media (max-width: 640px) {
		.profile-card__avatar-row {
			flex-direction: column;
			align-items: flex-start;
		}
		.profile-card__contact {
			flex-direction: column;
		}
		.profile-card__contact-item {
			border-right: 0;
			border-bottom: 2.5px solid var(--cmc-brown);
		}
		.profile-card__contact-item:last-child {
			border-bottom: 0;
		}
	}
</style>
