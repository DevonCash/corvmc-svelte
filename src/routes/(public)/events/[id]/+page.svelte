<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { IconShare3, IconCheck, IconCalendarPlus } from '@tabler/icons-svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import SectionLabel from '$lib/components/shared/SectionLabel.svelte';
	import PosterCard from '$lib/components/shared/events/PosterCard.svelte';
	import { fullDate, formatTime, formatCents } from '$lib/utils/format';
	import { sanitizeHtml } from '$lib/utils/markdown';
	import { tagToTapeVariant, tagToStickerColor } from '$lib/utils/tag-colors';
	import { googleCalendarUrl, icsDataUrl } from '$lib/utils/calendar';
	import { getPublicEventDetail } from '$lib/remote/events.remote';

	let data = $derived(await getPublicEventDetail(page.params.id!));

	const evt = $derived(data.event);
	// Descriptions are rich text (legacy rows contain HTML), so sanitize before
	// rendering to strip any XSS payload while keeping formatting.
	const descriptionHtml = $derived(evt.description ? sanitizeHtml(evt.description) : '');
	const isFreeEvent = $derived(!evt.ticketPrice || evt.ticketPrice === 0);
	const soldOut = $derived(data.remaining === 0);

	const discountedPrice = $derived(
		evt.ticketPrice && data.isSustainingMember ? Math.round(evt.ticketPrice / 2) : evt.ticketPrice
	);

	const capacityKnown = $derived(
		evt.ticketingEnabled && evt.ticketQuantity != null && data.sold != null
	);
	const lowAvailability = $derived(
		evt.ticketingEnabled &&
			data.remaining !== null &&
			!soldOut &&
			(data.remaining <= 10 ||
				(evt.ticketQuantity ? data.remaining / evt.ticketQuantity <= 0.15 : false))
	);
	const showUpsell = $derived(
		evt.ticketingEnabled && !isFreeEvent && !data.isSustainingMember && !soldOut && !data.isPast
	);

	const calendarEvt = $derived({
		title: evt.title,
		description: evt.description,
		location: evt.location,
		startsAt: evt.startsAt,
		endsAt: evt.endsAt
	});

	let copied = $state(false);

	function parseTags(tags: string | null): string[] {
		if (!tags) return [];
		return tags
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
	}

	const tagList = $derived(parseTags(evt.tags));
	const primaryTag = $derived(tagList[0] ?? null);

	const ticketsHref = $derived(resolve(`/events/${evt.id}/tickets`));

	async function share() {
		try {
			await navigator.clipboard.writeText(window.location.href);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			// clipboard unavailable — no-op
		}
	}
</script>

<svelte:head>
	<title>{evt.title} | Corvallis Music Collective</title>
	{#if evt.description}
		<meta name="description" content={evt.description.replace(/<[^>]*>/g, '').slice(0, 160)} />
	{/if}
	<meta property="og:title" content="{evt.title} | Corvallis Music Collective" />
	{#if evt.posterUrl}
		<meta property="og:image" content={evt.posterUrl} />
	{/if}
</svelte:head>

<section class="py-10 px-6">
	<div class="max-w-4xl mx-auto">
		<PageHeader title={evt.title} backHref="/events">
			<div class="flex items-center gap-1">
				<details class="dropdown dropdown-end">
					<summary class="btn btn-ghost btn-sm gap-1">
						<IconCalendarPlus size={18} />
						Add to calendar
					</summary>
					<ul class="menu dropdown-content z-10 w-48 rounded-box bg-base-100 p-2 shadow">
						<li>
							<a href={googleCalendarUrl(calendarEvt)} target="_blank" rel="noopener noreferrer"
								>Google Calendar</a
							>
						</li>
						<li>
							<a href={icsDataUrl(calendarEvt)} download="{evt.title}.ics">Apple / Outlook (.ics)</a
							>
						</li>
					</ul>
				</details>
				<button
					type="button"
					class="btn btn-ghost btn-sm btn-square"
					title="Copy link to this event"
					onclick={share}
				>
					{#if copied}
						<IconCheck size={18} />
					{:else}
						<IconShare3 size={18} />
					{/if}
				</button>
			</div>
		</PageHeader>

		<div class="edet">
			<div class="edet__poster">
				<PosterCard
					href={ticketsHref}
					title={evt.title}
					posterUrl={evt.posterUrl}
					startsAt={evt.startsAt}
					ticketingEnabled={evt.ticketingEnabled}
					ticketPrice={evt.ticketPrice}
					tags={evt.tags}
					tapeLabel={primaryTag ?? undefined}
					tapeColor={primaryTag ? tagToTapeVariant(primaryTag) : ''}
					isStatic
					class="w-full"
				/>
			</div>

			<div class="edet__main">
				{#if tagList.length > 0}
					<div class="edet__tags">
						{#each tagList as tag (tag)}
							<span class="sticker {tagToStickerColor(tag)}">{tag}</span>
						{/each}
					</div>
				{/if}

				<h1 class="edet__title">{evt.title}</h1>

				<div class="edet__facts">
					<div class="edet__fact">
						<span class="edet__fact-label">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								stroke-linecap="round"
								stroke-linejoin="round"
								style="width:13px;height:13px"
								><rect x="3" y="5" width="18" height="16" rx="2" /><path
									d="M3 9h18M8 3v4M16 3v4"
								/></svg
							>
							Date
						</span>
						<span class="edet__fact-value">{fullDate(evt.startsAt)}</span>
					</div>
					<div class="edet__fact">
						<span class="edet__fact-label">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								stroke-linecap="round"
								stroke-linejoin="round"
								style="width:13px;height:13px"
								><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg
							>
							Time
						</span>
						<span class="edet__fact-value">
							{formatTime(evt.startsAt)} – {formatTime(evt.endsAt)}
							{#if evt.doorsAt}
								<br /><span style="font-size:12px;opacity:0.7">Doors {formatTime(evt.doorsAt)}</span
								>
							{/if}
						</span>
					</div>
					{#if evt.location}
						<div class="edet__fact">
							<span class="edet__fact-label">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.8"
									stroke-linecap="round"
									stroke-linejoin="round"
									style="width:13px;height:13px"
									><path d="M12 21s-7-5.686-7-11a7 7 0 0 1 14 0c0 5.314-7 11-7 11Z" /><circle
										cx="12"
										cy="10"
										r="2.5"
									/></svg
								>
								Location
							</span>
							<span class="edet__fact-value">{evt.location}</span>
						</div>
					{/if}
					<div class="edet__fact">
						<span class="edet__fact-label">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								stroke-linecap="round"
								stroke-linejoin="round"
								style="width:13px;height:13px"
								><path
									d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z"
								/><path d="M13 6v12" /></svg
							>
							Price
						</span>
						<span class="edet__fact-value">
							{#if !evt.ticketingEnabled}
								Free
							{:else if evt.ticketPrice}
								{#if data.isSustainingMember && discountedPrice}
									{formatCents(discountedPrice)}
									<span
										style="font-size:11px;opacity:0.5;text-decoration:line-through;margin-left:4px"
										>{formatCents(evt.ticketPrice)}</span
									>
								{:else}
									{formatCents(evt.ticketPrice)}
								{/if}
							{:else}
								Free
							{/if}
						</span>
					</div>
				</div>

				{#if descriptionHtml}
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized rich text (sanitizeHtml) -->
					<p class="edet__desc">{@html descriptionHtml}</p>
				{/if}

				{#if capacityKnown}
					<div class="edet__capacity">
						<div class="edet__capacity-head">
							<span>{data.sold} of {evt.ticketQuantity} claimed</span>
							{#if lowAvailability}
								<Badge variant="warning">{isFreeEvent ? 'Almost full' : 'Selling fast'}</Badge>
							{/if}
						</div>
						<progress
							class="progress progress-primary w-full"
							value={data.sold}
							max={evt.ticketQuantity}
						></progress>
					</div>
				{/if}

				<div class="edet__ctas">
					{#if data.isPast}
						<span class="text-base font-medium" style="color: var(--fg-2)"
							>This event has ended.</span
						>
					{:else if evt.ticketingEnabled}
						{#if soldOut}
							<button class="btn btn-lg" disabled>{isFreeEvent ? 'Full' : 'Sold Out'}</button>
						{:else}
							<a href={ticketsHref} class="btn btn-primary btn-lg">
								{isFreeEvent ? 'RSVP' : 'Get Tickets'}
							</a>
							{#if data.remaining !== null}
								<span class="text-sm" style="color: var(--fg-2)"
									>{data.remaining} {isFreeEvent ? 'spots' : 'tickets'} remaining</span
								>
							{/if}
						{/if}

						{#if showUpsell && evt.ticketPrice}
							<p class="edet__upsell">
								Sustaining members pay {formatCents(Math.round(evt.ticketPrice / 2))}.
								<a href={resolve('/contribute')} class="link link-primary">Become a member →</a>
							</p>
						{/if}
					{:else}
						<!-- Non-ticketed event: RSVP requires a member account -->
						<a href={resolve('/login')} class="btn btn-primary btn-lg">Sign in to RSVP</a>
						{#if data.rsvpCount > 0}
							<span class="text-sm" style="color: var(--fg-2)">{data.rsvpCount} going</span>
						{/if}
					{/if}
				</div>
			</div>
		</div>

		{#if data.upcoming.length > 0}
			<section class="edet__more">
				<SectionLabel label="More shows" />
				<div class="edet__more-grid">
					{#each data.upcoming as e (e.id)}
						{@const eTags = parseTags(e.tags)}
						<PosterCard
							href="/events/{e.id}"
							title={e.title}
							posterUrl={e.posterUrl}
							startsAt={e.startsAt}
							ticketingEnabled={e.ticketingEnabled}
							ticketPrice={e.ticketPrice}
							tags={e.tags}
							tapeLabel={eTags[0] ?? undefined}
							tapeColor={eTags[0] ? tagToTapeVariant(eTags[0]) : ''}
						/>
					{/each}
				</div>
			</section>
		{/if}
	</div>
</section>

<style>
	/* Layout (.edet, .edet__poster/main/tags/title/facts/fact/desc/ctas) is
	   shared with the member event detail page and lives in routes/layout.css.
	   Only the rules unique to this page are defined locally below. */
	.edet__capacity {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.edet__capacity-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		font-size: 0.85rem;
		color: var(--fg-2);
	}

	.edet__upsell {
		font-size: 0.85rem;
		color: var(--fg-2);
	}

	.edet__more {
		margin-top: 3rem;
	}

	.edet__more-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.25rem;
	}

	@media (min-width: 768px) {
		.edet__more-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
