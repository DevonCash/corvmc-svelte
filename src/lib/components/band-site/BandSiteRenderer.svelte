<script lang="ts">
	import type { Block, BandEpk } from '$lib/server/db/schema/band-page';
	import { getEmbedUrl, detectPlatform } from '$lib/utils/link-platform';
	import { formatDate, formatTime } from '$lib/utils/format';
	import { sanitizeBio } from '$lib/utils/markdown';

	interface BandData {
		id: string;
		name: string;
		slug: string;
		bio: string | null;
		tagline: string | null;
		avatarUrl: string | null;
		links: Array<{ label: string; url: string; embed?: boolean }> | null;
		genres: string[];
	}

	interface ConfigData {
		theme: string;
		customCss: string | null;
		blocks: Block[];
		epk: BandEpk | null;
	}

	interface MemberData {
		id: string;
		name: string;
		image: string | null;
		position: string | null;
		role: string;
	}

	interface EventData {
		id: string;
		title: string;
		description: string | null;
		startsAt: Date;
		endsAt: Date;
		location: string | null;
		externalTicketUrl: string | null;
		posterUrl: string | null;
	}

	interface MediaData {
		id: string;
		url: string | null;
		type: string;
		caption: string | null;
	}

	let {
		band,
		config,
		members,
		events,
		media
	}: {
		band: BandData;
		config: ConfigData | null;
		members: MemberData[];
		events: EventData[];
		media: MediaData[];
	} = $props();

	const blocks = $derived(config?.blocks ?? []);
	const epk = $derived(config?.epk ?? null);

	// If no blocks configured, show a default layout
	const hasBlocks = $derived(blocks.length > 0);
</script>

{#if hasBlocks}
	<!-- Custom block layout -->
	{#each blocks as block (block.id)}
		<section class="band-site-block {block.cssClass ?? ''}">
			{#if block.type === 'hero'}
				<div class="band-site-hero relative h-64 md:h-96 overflow-hidden">
					<img src={block.imageKey} alt="" class="absolute inset-0 w-full h-full object-cover" />
					<div
						class="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white text-center px-4"
					>
						{#if block.headline}
							<h1 class="text-4xl md:text-6xl font-bold">{block.headline}</h1>
						{/if}
						{#if block.subtitle}
							<p class="text-xl mt-2 opacity-80">{block.subtitle}</p>
						{/if}
					</div>
				</div>
			{:else if block.type === 'bio'}
				<div class="max-w-3xl mx-auto px-6 py-8">
					<div class="prose prose-lg">
						{@html block.content}
					</div>
				</div>
			{:else if block.type === 'links'}
				{#if band.links && band.links.length > 0}
					<div class="max-w-md mx-auto px-6 py-8">
						<div class="flex flex-col gap-3">
							{#each band.links as link}
								{@const platform = detectPlatform(link.url)}
								<a
									href={link.url}
									target="_blank"
									rel="noopener"
									class="btn btn-outline w-full justify-start gap-3"
								>
									{#if platform}
										<span class="opacity-70">{platform.name}</span>
									{/if}
									<span>{link.label || platform?.name || 'Link'}</span>
								</a>
							{/each}
						</div>
					</div>
				{/if}
			{:else if block.type === 'members'}
				<div class="max-w-3xl mx-auto px-6 py-8">
					<h2 class="text-2xl font-bold mb-4">Members</h2>
					<div class="grid grid-cols-2 md:grid-cols-3 gap-4">
						{#each members as member (member.id)}
							<div class="text-center">
								<div class="avatar placeholder mb-2">
									<div class="bg-neutral text-neutral-content w-16 rounded-full">
										{#if member.image}
											<img src={member.image} alt={member.name} class="rounded-full" />
										{:else}
											<span class="text-xl">{member.name.charAt(0)}</span>
										{/if}
									</div>
								</div>
								<p class="font-medium">{member.name}</p>
								{#if block.showPositions && member.position}
									<p class="text-sm opacity-60">{member.position}</p>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{:else if block.type === 'events'}
				{#if events.length > 0}
					<div class="max-w-3xl mx-auto px-6 py-8">
						<h2 class="text-2xl font-bold mb-4">Upcoming Shows</h2>
						<div class="space-y-3">
							{#each events.slice(0, block.limit ?? 10) as evt (evt.id)}
								<div class="flex items-start justify-between p-4 rounded-lg bg-base-200">
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
							{/each}
						</div>
					</div>
				{/if}
			{:else if block.type === 'gallery'}
				<div class="max-w-4xl mx-auto px-6 py-8">
					<div class="grid grid-cols-2 md:grid-cols-3 gap-2">
						{#each media.filter((m) => m.type === 'image') as img (img.id)}
							{#if img.url}
								<div class="aspect-square overflow-hidden rounded-lg">
									<img src={img.url} alt={img.caption ?? ''} class="w-full h-full object-cover" />
								</div>
							{/if}
						{/each}
					</div>
				</div>
			{:else if block.type === 'embed'}
				{@const embedUrl = getEmbedUrl(block.url)}
				{#if embedUrl}
					<div class="max-w-3xl mx-auto px-6 py-4">
						<iframe
							src={embedUrl}
							title={block.platform}
							width="100%"
							height={block.url.includes('youtube') ? '400' : '166'}
							frameborder="0"
							allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
							allowfullscreen
							loading="lazy"
							class="rounded-lg"
						></iframe>
					</div>
				{/if}
			{:else if block.type === 'press'}
				{#if epk?.pressQuotes && epk.pressQuotes.length > 0}
					<div class="max-w-3xl mx-auto px-6 py-8">
						<h2 class="text-2xl font-bold mb-4">Press</h2>
						<div class="space-y-4">
							{#each epk.pressQuotes as quote}
								<blockquote class="border-l-4 border-primary pl-4">
									<p class="italic">"{quote.quote}"</p>
									<footer class="mt-1 text-sm opacity-70">
										&mdash; {quote.publication}
										{#if quote.date}
											<span class="opacity-60">({quote.date})</span>
										{/if}
									</footer>
								</blockquote>
							{/each}
						</div>
					</div>
				{/if}
			{:else if block.type === 'achievements'}
				{#if epk?.achievements && epk.achievements.length > 0}
					<div class="max-w-3xl mx-auto px-6 py-8">
						<h2 class="text-2xl font-bold mb-4">Highlights</h2>
						<ul class="space-y-2">
							{#each epk.achievements as achievement}
								<li class="flex items-start gap-2">
									<span class="text-primary">&#9733;</span>
									<span>{achievement}</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			{:else if block.type === 'contact'}
				{#if epk?.bookingContact || epk?.managementContact || epk?.prContact}
					<div class="max-w-3xl mx-auto px-6 py-8">
						<h2 class="text-2xl font-bold mb-4">Contact</h2>
						<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
							{#if epk.bookingContact}
								<div>
									<h3 class="font-semibold text-sm uppercase opacity-60">Booking</h3>
									<p class="font-medium">{epk.bookingContact.name}</p>
									<a href="mailto:{epk.bookingContact.email}" class="link text-sm"
										>{epk.bookingContact.email}</a
									>
									{#if epk.bookingContact.phone}
										<p class="text-sm opacity-70">{epk.bookingContact.phone}</p>
									{/if}
								</div>
							{/if}
							{#if epk.managementContact}
								<div>
									<h3 class="font-semibold text-sm uppercase opacity-60">Management</h3>
									<p class="font-medium">{epk.managementContact.name}</p>
									<a href="mailto:{epk.managementContact.email}" class="link text-sm"
										>{epk.managementContact.email}</a
									>
								</div>
							{/if}
							{#if epk.prContact}
								<div>
									<h3 class="font-semibold text-sm uppercase opacity-60">Press</h3>
									<p class="font-medium">{epk.prContact.name}</p>
									<a href="mailto:{epk.prContact.email}" class="link text-sm"
										>{epk.prContact.email}</a
									>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			{:else if block.type === 'tech_rider'}
				<div class="max-w-3xl mx-auto px-6 py-8">
					<h2 class="text-2xl font-bold mb-4">Technical Requirements</h2>
					{#if epk?.stagePlotKey}
						{@const stageMedia = media.find((m) => m.type === 'stage_plot')}
						{#if stageMedia?.url}
							<img src={stageMedia.url} alt="Stage Plot" class="rounded-lg mb-4 max-w-full" />
						{/if}
					{/if}
					{#if epk?.backline && epk.backline.length > 0}
						<h3 class="font-semibold mb-2">Backline Requirements</h3>
						<div class="overflow-x-auto">
							<table class="table table-sm">
								<thead>
									<tr>
										<th>Instrument</th>
										<th>Details</th>
										<th>Provided by</th>
									</tr>
								</thead>
								<tbody>
									{#each epk.backline as item}
										<tr>
											<td class="font-medium">{item.instrument}</td>
											<td>{item.details}</td>
											<td>{item.provided ? 'Band' : 'Venue'}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
					{#if epk?.technicalRiderKey}
						{@const riderMedia = media.find((m) => m.type === 'rider')}
						{#if riderMedia?.url}
							<a
								href={riderMedia.url}
								target="_blank"
								rel="noopener"
								class="btn btn-outline btn-sm mt-4"
							>
								Download Full Tech Rider (PDF)
							</a>
						{/if}
					{/if}
				</div>
			{:else if block.type === 'custom_html'}
				<div class="max-w-4xl mx-auto px-6 py-8">
					{@html block.content}
				</div>
			{:else if block.type === 'merch'}
				<div class="max-w-3xl mx-auto px-6 py-8">
					<h2 class="text-2xl font-bold mb-4">Merch</h2>
					<div class="grid grid-cols-2 md:grid-cols-3 gap-4">
						{#each block.items as item}
							<a href={item.url} target="_blank" rel="noopener" class="block group">
								{#if item.imageKey}
									<div class="aspect-square overflow-hidden rounded-lg mb-2">
										<img
											src={item.imageKey}
											alt={item.title}
											class="w-full h-full object-cover group-hover:scale-105 transition-transform"
										/>
									</div>
								{/if}
								<p class="font-medium group-hover:text-primary transition-colors">{item.title}</p>
								{#if item.price}
									<p class="text-sm opacity-60">{item.price}</p>
								{/if}
							</a>
						{/each}
					</div>
				</div>
			{:else if block.type === 'spacer'}
				<div class={block.height === 'sm' ? 'h-8' : block.height === 'md' ? 'h-16' : 'h-32'}></div>
			{/if}
		</section>
	{/each}
{:else}
	<!-- Default layout when no blocks are configured -->
	<div class="max-w-3xl mx-auto px-6 py-12">
		<div class="text-center mb-8">
			{#if band.avatarUrl}
				<img
					src={band.avatarUrl}
					alt={band.name}
					class="w-24 h-24 rounded-full mx-auto mb-4 object-cover"
				/>
			{/if}
			<h1 class="text-4xl font-bold">{band.name}</h1>
			{#if band.tagline}
				<p class="text-xl mt-2 opacity-70">{band.tagline}</p>
			{/if}
			{#if band.genres.length > 0}
				<p class="mt-2 opacity-60">{band.genres.join(' / ')}</p>
			{/if}
		</div>

		{#if band.bio}
			<div class="prose prose-sm max-w-none text-center text-base-content/80 mb-8">
				{@html sanitizeBio(band.bio)}
			</div>
		{/if}

		{#if band.links && band.links.length > 0}
			<div class="max-w-sm mx-auto space-y-3 mb-8">
				{#each band.links as link}
					{@const embedUrl = link.embed !== false ? getEmbedUrl(link.url) : null}
					{#if embedUrl}
						<iframe
							src={embedUrl}
							title={link.label}
							width="100%"
							height={embedUrl.includes('youtube') ? '315' : '166'}
							frameborder="0"
							allow="autoplay; clipboard-write; encrypted-media"
							allowfullscreen
							loading="lazy"
							class="rounded-lg"
						></iframe>
					{:else}
						{@const platform = detectPlatform(link.url)}
						<a href={link.url} target="_blank" rel="noopener" class="btn btn-outline w-full">
							{link.label || platform?.name || 'Link'}
						</a>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
{/if}

<!-- Navigation footer -->
<nav class="max-w-3xl mx-auto px-6 py-6 flex justify-center gap-4 text-sm opacity-60">
	{#if events.length > 0}
		<a href="events" class="hover:opacity-100 transition-opacity">All Events</a>
	{/if}
	{#if epk}
		<a href="epk" class="hover:opacity-100 transition-opacity">Press Kit</a>
	{/if}
</nav>
