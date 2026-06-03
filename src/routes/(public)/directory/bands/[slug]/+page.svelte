<script lang="ts">
	import ProfileLinks from '$lib/components/shared/directory/ProfileLinks.svelte';
	import ProfileEmbeds from '$lib/components/shared/directory/ProfileEmbeds.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import { formatDate, formatTime } from '$lib/utils/format';
	import { getPublicBandProfile } from '$lib/remote/directory.remote';
	import { getBandEventsPublic } from '$lib/remote/band-events.remote';
	import { sanitizeBio } from '$lib/utils/markdown';
	import { page } from '$app/state';

	let data = $derived(await getPublicBandProfile(page.params.slug!));
	let events = $derived(await getBandEventsPublic(data.band.id));

	const band = $derived(data.band);
	const members = $derived(data.members);
	const contact = $derived(band.directoryContact ?? {});
	const hasContact = $derived(!!contact.email || !!contact.phone || !!contact.social);
</script>

<svelte:head>
	<title>{band.name} | Corvallis Music Collective</title>
	<meta name="description" content={band.tagline || `${band.name} on Corvallis Music Collective`} />
	<meta property="og:title" content={band.name} />
	<meta property="og:description" content={band.tagline || `${band.name} on Corvallis Music Collective`} />
	{#if band.avatarUrl}
		<meta property="og:image" content={band.avatarUrl} />
	{/if}
</svelte:head>

<div class="min-h-screen bg-base-200">
	<!-- Band hero section -->
	<div class="bg-base-100 pb-8">
		<div class="max-w-2xl mx-auto px-6 pt-8">
			<div class="flex flex-col items-center text-center">
				<div class="avatar placeholder mb-4">
					<div class="bg-neutral text-neutral-content w-24 rounded-full ring ring-base-300">
						{#if band.avatarUrl}
							<img src={band.avatarUrl} alt={band.name} class="rounded-full" />
						{:else}
							<span class="text-4xl">{band.name.charAt(0).toUpperCase()}</span>
						{/if}
					</div>
				</div>
				<h1 class="text-3xl font-bold">{band.name}</h1>
				{#if band.tagline}
					<p class="mt-1 text-lg opacity-70">{band.tagline}</p>
				{/if}

				{#if band.genres?.length}
					<div class="flex flex-wrap justify-center gap-1 mt-3">
						{#each band.genres as genre}
							<Badge variant="ghost">{genre}</Badge>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="max-w-2xl mx-auto px-6 py-8 space-y-8">
		<!-- Bio -->
		{#if band.bio}
			<section>
				<div class="prose prose-sm max-w-none text-base-content/80">{@html sanitizeBio(band.bio)}</div>
			</section>
		{/if}

		<!-- Embeds (music/video) -->
		{#if band.links && band.links.length > 0}
			<ProfileEmbeds links={band.links} />
		{/if}

		<!-- Links as buttons -->
		{#if band.links && band.links.length > 0}
			<section>
				<ProfileLinks links={band.links} />
			</section>
		{/if}

		<!-- Upcoming events -->
		{#if events.length > 0}
			<section>
				<h2 class="text-lg font-semibold mb-3">Upcoming Shows</h2>
				<div class="space-y-3">
					{#each events as evt (evt.id)}
						<div class="card bg-base-100 shadow-sm">
							<div class="card-body py-4">
								<div class="flex items-start justify-between">
									<div>
										<p class="font-medium">{evt.title}</p>
										<p class="text-sm opacity-70">
											{formatDate(evt.startsAt)} &middot; {formatTime(evt.startsAt)}
										</p>
										{#if evt.location}
											<p class="text-sm opacity-60">{evt.location}</p>
										{/if}
									</div>
									{#if evt.externalTicketUrl}
										<a
											href={evt.externalTicketUrl}
											target="_blank"
											rel="noopener"
											class="btn btn-primary btn-sm"
										>
											Tickets
										</a>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Members -->
		<section>
			<h2 class="text-lg font-semibold mb-3">Members</h2>
			<div class="flex flex-wrap gap-4">
				{#each members as member (member.id)}
					<div class="flex items-center gap-2">
						<div class="avatar placeholder">
							<div class="bg-neutral text-neutral-content w-8 rounded-full">
								{#if member.userImage}
									<img src={member.userImage} alt={member.userName} class="rounded-full" />
								{:else}
									<span class="text-xs">{member.userName.charAt(0).toUpperCase()}</span>
								{/if}
							</div>
						</div>
						<div>
							<p class="text-sm font-medium">{member.userName}</p>
							{#if member.position}
								<p class="text-xs opacity-60">{member.position}</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</section>

		<!-- Contact -->
		{#if hasContact}
			<section>
				<h2 class="text-sm font-semibold mb-2">Contact</h2>
				<dl class="grid gap-x-4 gap-y-1 text-sm" style="grid-template-columns: auto 1fr;">
					{#if contact.email}
						<dt class="opacity-60">Email</dt>
						<dd><a href="mailto:{contact.email}" class="link">{contact.email}</a></dd>
					{/if}
					{#if contact.phone}
						<dt class="opacity-60">Phone</dt>
						<dd>{contact.phone}</dd>
					{/if}
					{#if contact.social}
						<dt class="opacity-60">Social</dt>
						<dd>{contact.social}</dd>
					{/if}
				</dl>
			</section>
		{/if}
	</div>

	<!-- Minimal footer -->
	<footer class="text-center py-6 text-xs opacity-40">
		<a href="/" class="hover:opacity-70">Corvallis Music Collective</a>
	</footer>
</div>
