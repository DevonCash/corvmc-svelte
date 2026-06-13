<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { IconShare3, IconCheck, IconCalendarPlus } from '@tabler/icons-svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import { Field } from '$lib/components/shared/Form';
	import Badge from '$lib/components/shared/Badge.svelte';
	import SectionLabel from '$lib/components/shared/SectionLabel.svelte';
	import PosterCard from '$lib/components/shared/events/PosterCard.svelte';
	import TicketStub from '$lib/components/shared/events/TicketStub.svelte';
	import TicketQRModal from '$lib/components/shared/events/TicketQRModal.svelte';
	import { fullDate, formatTime, formatCents } from '$lib/utils/format';
	import { sanitizeHtml } from '$lib/utils/markdown';
	import { tagToTapeVariant, tagToStickerColor } from '$lib/utils/tag-colors';
	import { googleCalendarUrl, icsDataUrl } from '$lib/utils/calendar';
	import {
		purchaseTickets,
		rsvpForEvent,
		rsvpToEvent,
		cancelRsvp,
		getMemberEventDetail,
		getMemberTickets
	} from '$lib/remote/events.remote';

	const { fields } = purchaseTickets;
	const rsvpFields = rsvpForEvent.fields;
	const rsvpToEventFields = rsvpToEvent.fields;
	const cancelRsvpFields = cancelRsvp.fields;

	let eventData = $derived(await getMemberEventDetail(page.params.id!));
	let allTickets = $derived(await getMemberTickets());
	let myTickets = $derived(
		allTickets.filter((t) => t.eventId === page.params.id && t.status !== 'cancelled')
	);
	let myTicket = $derived(myTickets[0] ?? null);
	let data = $derived({ ...eventData, myTicket });

	const evt = $derived(data.event);
	// Descriptions are rich text (legacy rows contain HTML), so sanitize before
	// rendering to strip any XSS payload while keeping formatting.
	const descriptionHtml = $derived(evt.description ? sanitizeHtml(evt.description) : '');
	const isFreeEvent = $derived(!evt.ticketPrice || evt.ticketPrice === 0);
	const soldOut = $derived(data.remaining === 0);
	const maxQuantity = $derived(data.remaining !== null ? Math.min(data.remaining, 10) : 10);

	const discountedPrice = $derived(
		evt.ticketPrice && data.isSustainingMember ? Math.round(evt.ticketPrice / 2) : evt.ticketPrice
	);

	// Availability visuals (ticketed, capacity-capped events only)
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
	// Show the membership upsell to non-sustaining members on paid, available events.
	const showUpsell = $derived(
		evt.ticketingEnabled && !isFreeEvent && !data.isSustainingMember && !soldOut
	);

	const quantityOptions = $derived(
		Array.from({ length: maxQuantity }, (_, i) => ({ value: i + 1, label: String(i + 1) }))
	);

	const calendarEvt = $derived({
		title: evt.title,
		description: evt.description,
		location: evt.location,
		startsAt: evt.startsAt,
		endsAt: evt.endsAt
	});

	let quantity = $state(1);
	let attendeeName = $state((page.data as any).user?.name ?? '');
	let attendeeEmail = $state((page.data as any).user?.email ?? '');
	let coverFees = $state(false);
	let qrOpen = $state(false);
	let qrIndex = $state(0);
	let copied = $state(false);

	const subtotal = $derived((discountedPrice ?? 0) * quantity);

	function parseTags(tags: string | null): string[] {
		if (!tags) return [];
		return tags
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
	}

	const tagList = $derived(parseTags(evt.tags));
	const primaryTag = $derived(tagList[0] ?? null);

	async function share() {
		try {
			await navigator.clipboard.writeText(window.location.href);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			// clipboard unavailable — no-op
		}
	}

	function refreshDetail() {
		void getMemberEventDetail(page.params.id!).refresh();
		void getMemberTickets().refresh();
	}

	async function handlePurchaseSuccess(result?: unknown) {
		const data = result as { redirectUrl?: string } | undefined;
		if (data?.redirectUrl) {
			if (data.redirectUrl.startsWith('http')) {
				window.location.href = data.redirectUrl;
			} else {
				await goto(data.redirectUrl);
			}
		}
	}
</script>

<PageHeader title={evt.title} backHref={resolve('/member/events')}>
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
					<a href={icsDataUrl(calendarEvt)} download="{evt.title}.ics">Apple / Outlook (.ics)</a>
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
<PageContent>
	{#if myTickets.length > 0}
		<section>
			<SectionLabel
				label={myTickets.length === 1 ? 'Your ticket' : 'Your tickets'}
				count={myTickets.length}
			/>
			<div class="edet__stubs">
				{#each myTickets as t, i (t.id)}
					<TicketStub
						ticket={t}
						tags={evt.tags}
						onclick={() => {
							qrIndex = i;
							qrOpen = true;
						}}
					/>
				{/each}
			</div>
		</section>
		<TicketQRModal bind:open={qrOpen} tickets={myTickets} initialIndex={qrIndex} />
	{/if}

	<div class="edet">
		<div class="edet__poster">
			<PosterCard
				href={resolve(`/member/events/${evt.id}`)}
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
							<br /><span style="font-size:12px;opacity:0.7">Doors {formatTime(evt.doorsAt)}</span>
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

			{#if evt.ticketingEnabled}
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
					{#if soldOut}
						<button class="btn btn-lg" disabled>{isFreeEvent ? 'Full' : 'Sold Out'}</button>
					{:else if !data.myTicket}
						{#if isFreeEvent}
							<Action
								action={rsvpForEvent}
								label="RSVP"
								modalTitle="RSVP"
								submitLabel="RSVP{quantity > 1 ? ` for ${quantity}` : ''}"
								canSubmit={!!attendeeName.trim() && !!attendeeEmail.trim()}
								class="btn-primary btn-lg"
								onsuccess={handlePurchaseSuccess}
								onfailure={(err) =>
									toast.error(err instanceof Error ? err.message : 'Something went wrong')}
							>
								{#snippet form()}
									<input {...rsvpFields.eventId.as('hidden', evt.id)} />

									<Field
										label="Number of spots"
										name="quantity"
										type="select"
										options={quantityOptions}
										bind:value={quantity}
									/>

									<Field name="attendeeName" type="text" label="Name" bind:value={attendeeName} />
									<Field
										name="attendeeEmail"
										type="email"
										label="Email"
										bind:value={attendeeEmail}
									/>
								{/snippet}
							</Action>
						{:else}
							<Action
								action={purchaseTickets}
								label="Get Tickets"
								modalTitle="Get Tickets"
								submitLabel="Purchase {quantity === 1 ? 'Ticket' : `${quantity} Tickets`}"
								canSubmit={!!attendeeName.trim() && !!attendeeEmail.trim()}
								class="btn-primary btn-lg"
								onsuccess={handlePurchaseSuccess}
								onfailure={(err) =>
									toast.error(err instanceof Error ? err.message : 'Something went wrong')}
							>
								{#snippet form()}
									<input {...fields.eventId.as('hidden', evt.id)} />

									<div class="flex items-baseline gap-2">
										{#if data.isSustainingMember && discountedPrice}
											<span class="text-lg font-bold">{formatCents(discountedPrice)}</span>
											<span class="text-sm line-through opacity-50"
												>{formatCents(evt.ticketPrice!)}</span
											>
											<Badge variant="success">Member 50% off</Badge>
										{:else}
											<span class="text-lg font-bold">{formatCents(evt.ticketPrice!)}</span>
										{/if}
										<span class="text-sm opacity-50">per ticket</span>
									</div>

									<Field
										label="Number of tickets"
										name="quantity"
										type="select"
										options={quantityOptions}
										bind:value={quantity}
									/>

									<Field name="attendeeName" type="text" label="Name" bind:value={attendeeName} />
									<Field
										name="attendeeEmail"
										type="email"
										label="Email"
										bind:value={attendeeEmail}
									/>
									<Field
										name="coverFees"
										type="checkbox"
										bind:value={coverFees}
										checkboxLabel="Cover processing fees so the collective receives the full amount"
									/>

									<div class="border-t border-base-200 pt-4">
										<div class="flex justify-between text-lg font-medium">
											<span>Total</span>
											<span>{formatCents(subtotal)}</span>
										</div>
										{#if data.isSustainingMember}
											<p class="text-sm text-success mt-1">Sustaining member discount applied</p>
										{/if}
									</div>
								{/snippet}
							</Action>
						{/if}
					{/if}

					{#if showUpsell && evt.ticketPrice}
						<p class="edet__upsell">
							Sustaining members pay {formatCents(Math.round(evt.ticketPrice / 2))}.
							<a href={resolve('/member/membership')} class="link link-primary">Become a member →</a
							>
						</p>
					{/if}

					{#if data.remaining !== null && !soldOut}
						<span class="text-sm" style="color: var(--fg-2)"
							>{data.remaining} {isFreeEvent ? 'spots' : 'tickets'} remaining</span
						>
					{/if}
				</div>
			{:else}
				<!-- Non-ticketed event: lightweight RSVP (join table, no QR / check-in) -->
				<div class="edet__ctas">
					{#if data.myRsvp}
						<div class="tixbanner tixbanner--static">
							<div class="tixbanner__icon">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									style="width:20px;height:20px"><path d="M5 12l4 4 10-10" /></svg
								>
							</div>
							<div class="tixbanner__text">
								<strong>You're going!</strong>
								<small>We'll see you there</small>
							</div>
						</div>
						<Action
							action={cancelRsvp}
							label="Can't make it?"
							confirm="Cancel your RSVP for this event?"
							modalTitle="Cancel RSVP"
							submitLabel="Yes, cancel my RSVP"
							submitClass="btn-error"
							class="btn-ghost btn-sm"
							onsuccess={refreshDetail}
						>
							{#snippet form()}
								<input {...cancelRsvpFields.eventId.as('hidden', evt.id)} />
							{/snippet}
						</Action>
					{:else}
						<Action
							action={rsvpToEvent}
							label="RSVP"
							modalTitle="RSVP"
							submitLabel="RSVP"
							canSubmit={!!attendeeName.trim() && !!attendeeEmail.trim()}
							class="btn-primary btn-lg"
							onsuccess={refreshDetail}
							onfailure={(err) =>
								toast.error(err instanceof Error ? err.message : 'Something went wrong')}
						>
							{#snippet form()}
								<input {...rsvpToEventFields.eventId.as('hidden', evt.id)} />
								<Field name="attendeeName" type="text" label="Name" bind:value={attendeeName} />
								<Field name="attendeeEmail" type="email" label="Email" bind:value={attendeeEmail} />
							{/snippet}
						</Action>
					{/if}

					{#if data.rsvpCount > 0}
						<span class="text-sm" style="color: var(--fg-2)">{data.rsvpCount} going</span>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	{#if data.upcoming.length > 0}
		<section class="edet__more">
			<SectionLabel label="More shows" />
			<div class="edet__more-grid">
				{#each data.upcoming as e (e.id)}
					{@const eTags = parseTags(e.tags)}
					<PosterCard
						href={resolve(`/member/events/${e.id}`)}
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
</PageContent>

<style>
	.edet__stubs {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}

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

	.tixbanner--static {
		cursor: default;
	}

	.edet__upsell {
		font-size: 0.85rem;
		color: var(--fg-2);
	}

	.edet__more {
		margin-top: 2.5rem;
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
