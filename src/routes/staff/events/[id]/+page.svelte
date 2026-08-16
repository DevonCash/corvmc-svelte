<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { toast } from 'svelte-sonner';
	import { responseErrorMessage } from '$lib/api';
	import {
		PublishEventAction,
		UnpublishEventAction,
		CancelEventAction,
		DeleteEventAction,
		CompTicketsAction
	} from '$lib/components/shared/actions';
	import {
		getStaffEventDetail,
		updateEvent,
		checkRebook,
		checkConflicts,
		getEventRecurringSeries,
		cancelEventSeries
	} from '$lib/remote/events.remote';
	const { fields } = updateEvent;
	import ConflictWarnings from '$lib/components/shared/reservations/ConflictWarnings.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import Table from '$lib/components/shared/Table.svelte';
	import { formatDollars, formatTime, fullDate, toLocalDate, toLocalTime } from '$lib/utils/format';
	import { priceDisplay } from '$lib/utils/event-ticketing';
	import Badge from '$lib/components/shared/Badge.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import { IconMusic } from '@tabler/icons-svelte';
	import { formatEventTimeRange } from '$lib/utils/event-time';
	import Action from '$lib/components/shared/Action.svelte';
	import Alert from '$lib/components/shared/Alert.svelte';
	import { invalidateAll } from '$app/navigation';
	import { rejectListing } from '$lib/remote/community-events.remote';

	const rejectFields = rejectListing.fields;

	let id = $derived(page.params.id!);
	let data = $derived(await getStaffEventDetail(id));

	const evt = $derived(data.event);
	const isBandEvent = $derived(evt.source === 'band');
	const isCommunityEvent = $derived(evt.source === 'community');
	// CMC only sells shows CMC produces — see the rule in event-service.update().
	const cmcCanSell = $derived(evt.source === 'cmc');
	const recurringSeries = $derived(await getEventRecurringSeries(id));

	// ── Edit state ────────────────────────────────────────────────────────
	let editing = $state(false);
	let editTitle = $state('');
	let editDescription = $state('');
	let editTags = $state('');
	let editLocation = $state('');
	let editExternalTicketUrl = $state('');
	let editDate = $state('');
	let editStartTime = $state('');
	let editEndTime = $state('');
	let editDoorsTime = $state('');
	let editReservationStartTime = $state('');
	let editReservationEndTime = $state('');
	let editTicketingEnabled = $state(false);
	let editTicketPriceDollars = $state('');
	let editTicketQuantity = $state('');

	// Rebook state
	let rebookNeeded = $state(false);
	let rebookReason = $state('');
	let rebookConfirmed = $state(false);
	let overrideConflicts = $state(false);

	let hasConflicts = $state(false);

	// Ticket price in cents for the hidden field. Independent of the ticketing
	// toggle: it's the price attendees pay wherever they buy.
	const editTicketPriceCents = $derived(
		editTicketPriceDollars ? String(Math.round(parseFloat(editTicketPriceDollars) * 100)) : ''
	);

	function startEditing() {
		editTitle = evt.title;
		editDescription = evt.description ?? '';
		editTags = evt.tags ?? '';
		editLocation = evt.location ?? '';
		editExternalTicketUrl = evt.externalTicketUrl ?? '';

		// Parse existing dates into form values
		editDate = toLocalDate(evt.startsAt);
		editStartTime = toLocalTime(evt.startsAt);
		editEndTime = evt.endsAt ? toLocalTime(evt.endsAt) : '';
		editDoorsTime = evt.doorsAt ? toLocalTime(evt.doorsAt) : '';

		// Pre-fill ticketing fields. Forced off for a band gig, which is never sold
		// through our checkout. Submitting `false` rather than omitting the field
		// means opening this form on a row that predates that rule also clears the
		// stale flag — `update()` rejects enabling ticketing on a band event but
		// allows disabling it. The price is untouched: a band gig legitimately has
		// one for the door or an outside seller.
		editTicketingEnabled = cmcCanSell ? evt.ticketingEnabled : false;
		editTicketPriceDollars = evt.ticketPrice ? formatDollars(evt.ticketPrice) : '';
		editTicketQuantity = evt.ticketQuantity ? String(evt.ticketQuantity) : '';

		// Pre-fill reservation times from linked reservation
		if (data.linkedReservation) {
			editReservationStartTime = toLocalTime(data.linkedReservation.startsAt);
			editReservationEndTime = toLocalTime(data.linkedReservation.endsAt);
		} else {
			editReservationStartTime = '';
			editReservationEndTime = '';
		}

		rebookNeeded = false;
		rebookReason = '';
		rebookConfirmed = false;
		overrideConflicts = false;
		editing = true;
	}

	function cancelEditing() {
		editing = false;
		rebookNeeded = false;
		rebookConfirmed = false;
	}

	// Check if times changed enough to need a rebook
	async function checkForRebook() {
		if (!data.linkedReservation || !editDate || !editStartTime || !editEndTime) {
			rebookNeeded = false;
			return;
		}

		const { startsAt: newStartsAt, endsAt: newEndsAt } = buildISORangeFromLocal(
			editDate,
			editStartTime,
			editEndTime
		);

		const result = await checkRebook({
			eventId: evt.id,
			newStartsAt,
			newEndsAt
		});

		rebookNeeded = result.needed;
		rebookReason = result.reason ?? '';

		if (result.needed) {
			// Default reservation times to event times when rebook is triggered
			editReservationStartTime = editStartTime;
			editReservationEndTime = editEndTime;
			rebookConfirmed = false;
		}
	}

	async function handleUpdateSuccess() {
		editing = false;
		rebookNeeded = false;
		rebookConfirmed = false;
		void getStaffEventDetail(id).refresh();
	}

	async function handlePosterUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const formData = new FormData();
		formData.append('poster', file);

		try {
			const res = await fetch(`/api/events/${evt.id}/poster`, {
				method: 'POST',
				body: formData
			});
			if (!res.ok) throw new Error(await responseErrorMessage(res, 'Upload failed'));
			toast.success('Poster updated');
			void getStaffEventDetail(id).refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to upload poster');
		}
	}

	// ── Helpers ───────────────────────────────────────────────────────────

	/** Add one calendar day to a "YYYY-MM-DD" string. */
	function nextDay(date: string): string {
		const [year, month, day] = date.split('-').map(Number);
		return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
	}

	function buildISORangeFromLocal(
		date: string,
		startTime: string,
		endTime: string
	): { startsAt: string; endsAt: string } {
		// Build rough ISO strings for the rebook check query.
		// The server will parse with proper timezone handling.
		const startsAt = new Date(`${date}T${startTime}:00`);
		// One date field covers both times: a show that ends past midnight ends on
		// the following day, same as the server builds it when the form is saved.
		const endsOnNextDay = new Date(`${date}T${endTime}:00`) < startsAt;
		const endsAt = new Date(`${endsOnNextDay ? nextDay(date) : date}T${endTime}:00`);

		return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
	}

	function parseTags(tags: string | null): string[] {
		if (!tags) return [];
		return tags
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
	}
</script>

<PageHeader title={evt.title} backHref="/staff/events">
	<div class="flex items-center gap-2">
		{#if evt.ticketingEnabled}
			<Button href="/staff/events/{evt.id}/check-in" class="btn-sm btn-ghost">Check-in</Button>
		{/if}

		{#if evt.status !== 'cancelled' && !editing}
			<Button class="btn-sm btn-ghost" onclick={startEditing}>Edit</Button>
		{/if}

		{#if evt.status === 'draft'}
			<PublishEventAction eventId={evt.id} />
		{/if}

		{#if evt.status === 'pending_review'}
			<!-- Approving is the same transition as publishing a draft, so it goes
			     through the same action. Turning it down is its own thing: it needs
			     a reason, because `rejected` exists so the member can fix and
			     resubmit. -->
			<PublishEventAction eventId={evt.id} label="Approve" />
			<Action
				action={rejectListing}
				label="Turn down"
				successToast="Sent back to the member"
				class="btn-warning btn-sm"
				onsuccess={() => invalidateAll()}
			>
				{#snippet form()}
					<input {...rejectFields.eventId.as('hidden', evt.id)} />
					<FormField
						field={rejectFields.notes}
						type="textarea"
						label="What needs to change?"
						description="The member sees this. Without it they can't fix the listing."
					/>
				{/snippet}
			</Action>
		{/if}

		{#if evt.status === 'published'}
			<UnpublishEventAction eventId={evt.id} />
		{/if}

		{#if evt.status !== 'cancelled'}
			<CancelEventAction eventId={evt.id} />
		{/if}

		<DeleteEventAction eventId={evt.id} />
	</div>
</PageHeader>
<PageContent width="3xl">
	<!-- Status -->
	<div class="flex items-center gap-2">
		<StatusBadge status={evt.status} />
		{#if evt.publishedAt}
			<span class="text-sm opacity-50">Published {fullDate(evt.publishedAt)}</span>
		{/if}
	</div>

	<!-- Recurring series -->
	{#if recurringSeries}
		<div class="flex flex-wrap items-center gap-2">
			<Badge class="badge-info">Recurring · {recurringSeries.frequencyLabel}</Badge>
			{#if recurringSeries.cancelledAt}
				<span class="text-sm opacity-50">Series cancelled — no new occurrences</span>
			{:else}
				<span class="text-sm opacity-50">
					{#if recurringSeries.endsAt}
						Repeats until {fullDate(recurringSeries.endsAt)}
					{:else}
						New occurrences are generated automatically
					{/if}
				</span>
				<Form
					remote={cancelEventSeries}
					successToast="Series cancelled"
					onsuccess={() => void getEventRecurringSeries(id).refresh()}
				>
					<input {...cancelEventSeries.fields.seriesId.as('hidden', recurringSeries.id)} />
					<SubmitButton label="Cancel series" class="btn-xs btn-ghost text-error" />
				</Form>
			{/if}
		</div>
	{/if}

	<!-- Edit form -->
	{#if editing}
		<svelte:boundary>
			<div class="card bg-base-100 shadow">
				<div class="card-body space-y-4">
					<h3 class="text-sm font-medium opacity-60">Edit Event</h3>

					<Form remote={updateEvent} guard successToast="Updated" onsuccess={handleUpdateSuccess}>
						<input {...fields.eventId.as('hidden', evt.id)} />
						<input {...fields.ticketingEnabled.as('hidden', editTicketingEnabled)} />
						<!-- Always submitted: the price is the attendee's price whoever sells
						     the ticket, so it has to survive the ticketing toggle being off. -->
						<input {...fields.ticketPrice.as('hidden', editTicketPriceCents)} />
						{#if rebookNeeded && rebookConfirmed}
							<input {...fields.rebookReservation.as('hidden', true)} />
						{/if}
						{#if overrideConflicts}
							<input {...fields.overrideConflicts.as('hidden', true)} />
						{/if}

						<div class="space-y-4">
							<FormField label="Title" id="editTitle" issues={[]}>
								<input
									id="editTitle"
									name="title"
									type="text"
									bind:value={editTitle}
									class="input input-bordered w-full"
									required
								/>
							</FormField>

							<FormField label="Description" id="editDesc" issues={[]}>
								<textarea
									id="editDesc"
									name="description"
									bind:value={editDescription}
									class="textarea textarea-bordered w-full"
									rows="4"
								></textarea>
							</FormField>

							<FormField label="Date" id="editDate" issues={[]}>
								<input
									id="editDate"
									name="eventDate"
									type="date"
									bind:value={editDate}
									class="input input-bordered w-full"
									required
									onchange={checkForRebook}
								/>
							</FormField>

							<div class="grid grid-cols-2 gap-4">
								<FormField label="Start time" id="editStartTime" issues={[]}>
									<input
										id="editStartTime"
										name="eventStartTime"
										type="time"
										bind:value={editStartTime}
										class="input input-bordered w-full"
										required
										onchange={checkForRebook}
									/>
								</FormField>

								<FormField label="End time" id="editEndTime" issues={[]}>
									<input
										id="editEndTime"
										name="eventEndTime"
										type="time"
										bind:value={editEndTime}
										class="input input-bordered w-full"
										required
										onchange={checkForRebook}
									/>
								</FormField>
							</div>

							<FormField label="Doors time" id="editDoorsTime" issues={[]}>
								<input
									id="editDoorsTime"
									name="doorsTime"
									type="time"
									bind:value={editDoorsTime}
									class="input input-bordered w-full"
								/>
							</FormField>

							<FormField label="Tags" id="editTags" issues={[]}>
								<input
									id="editTags"
									name="tags"
									type="text"
									bind:value={editTags}
									class="input input-bordered w-full"
									placeholder="e.g. open mic, workshop"
								/>
							</FormField>

							<!-- Venue and ticket link: what a band gig is made of. CMC shows
							     happen at the space and sell through us, so both stay optional. -->
							<FormField label="Location" id="editLocation" issues={[]}>
								<input
									id="editLocation"
									name="location"
									type="text"
									bind:value={editLocation}
									class="input input-bordered w-full"
									placeholder="Venue name and address"
								/>
							</FormField>

							<FormField label="External ticket URL" id="editTicketUrl" issues={[]}>
								<input
									id="editTicketUrl"
									name="externalTicketUrl"
									type="url"
									bind:value={editExternalTicketUrl}
									class="input input-bordered w-full"
									placeholder="https://..."
								/>
							</FormField>

							<!-- The price is what attendees pay wherever they buy — our checkout,
							     the link above, or the door — so it lives outside the ticketing
							     toggle and applies to band gigs too. Only capacity depends on us
							     doing the selling. -->
							<FormField label="Ticket price ($)" id="editTicketPrice" issues={[]}>
								<input
									id="editTicketPrice"
									type="number"
									bind:value={editTicketPriceDollars}
									min="0.01"
									step="0.01"
									placeholder="15.00"
									class="input input-bordered w-full"
									required={editTicketingEnabled}
								/>
								<span class="label-text-alt opacity-60 mt-1"> Leave blank for a free event. </span>
							</FormField>

							<!-- Selling through our checkout is the one thing a band gig cannot
							     do: `update()` throws on it, so offering the toggle here would
							     only produce a failed save. The band's own link takes the money. -->
							{#if !cmcCanSell}
								<p class="text-sm opacity-60">
									CMC doesn't sell tickets for shows it isn't producing — the price above is what
									attendees pay at the door or through the {isBandEvent ? "band's" : 'listed'} ticket
									link.
								</p>
							{:else}
								<div class="form-control">
									<label class="label cursor-pointer justify-start gap-3">
										<input type="checkbox" bind:checked={editTicketingEnabled} class="toggle" />
										<span class="label-text">Sell tickets through the site</span>
									</label>
								</div>
							{/if}

							{#if editTicketingEnabled}
								<div class="card bg-base-200 p-4">
									<FormField label="Capacity" id="editTicketQuantity" issues={[]}>
										<input
											id="editTicketQuantity"
											name="ticketQuantity"
											type="number"
											bind:value={editTicketQuantity}
											min="1"
											step="1"
											placeholder="Unlimited"
											class="input input-bordered w-full"
										/>
									</FormField>
									<p class="text-sm opacity-60 mt-2">Leave capacity blank for unlimited tickets.</p>
								</div>
							{/if}

							<!-- Rebook warning -->
							{#if rebookNeeded}
								<div class="alert alert-warning" role="alert">
									<div class="w-full space-y-3">
										<p class="font-medium">Reservation needs rebooking</p>
										<p class="text-sm">
											{rebookReason}. The existing reservation will be cancelled and a new one
											created.
										</p>

										<label class="label cursor-pointer justify-start gap-3">
											<input
												type="checkbox"
												bind:checked={rebookConfirmed}
												class="checkbox checkbox-sm"
											/>
											<span class="label-text">Confirm rebook</span>
										</label>

										{#if rebookConfirmed}
											<div class="grid grid-cols-2 gap-4 mt-2">
												<FormField label="Reservation start" id="editResStart" issues={[]}>
													<input
														id="editResStart"
														name="reservationStartTime"
														type="time"
														bind:value={editReservationStartTime}
														class="input input-bordered w-full"
													/>
												</FormField>
												<FormField label="Reservation end" id="editResEnd" issues={[]}>
													<input
														id="editResEnd"
														name="reservationEndTime"
														type="time"
														bind:value={editReservationEndTime}
														class="input input-bordered w-full"
													/>
												</FormField>
											</div>

											<ConflictWarnings
												date={editDate}
												startTime={editReservationStartTime}
												endTime={editReservationEndTime}
												{checkConflicts}
												excludeReservationId={data.linkedReservation?.id}
												bind:hasConflicts
											/>
											{#if hasConflicts}
												<label class="label cursor-pointer justify-start gap-3">
													<input
														type="checkbox"
														bind:checked={overrideConflicts}
														class="checkbox checkbox-sm"
													/>
													<span class="label-text">Override conflicts</span>
												</label>
											{/if}
										{/if}
									</div>
								</div>
							{/if}

							<div class="flex justify-end gap-2 pt-2">
								<Button type="button" class="btn-ghost btn-sm" onclick={cancelEditing}
									>Cancel</Button
								>
								<SubmitButton label="Save" class="btn-primary btn-sm" />
							</div>
						</div>
					</Form>
				</div>
			</div>

			{#snippet pending()}
				<div class="card bg-base-100 shadow">
					<div class="card-body flex items-center justify-center p-8">
						<span class="loading loading-spinner loading-md"></span>
					</div>
				</div>
			{/snippet}
		</svelte:boundary>
	{/if}

	{#if isCommunityEvent}
		<!-- Enough to judge the listing without leaving the page: who posted it,
		     and whether they're here because of a past problem. -->
		<InfoCard title="Submitted by">
			<p class="flex flex-wrap items-center gap-2 text-sm">
				<a href={resolve(`/staff/users/${data.submitterId}`)} class="link font-medium">
					{data.creator?.name ?? 'Unknown member'}
				</a>
				{#if data.creator?.email}
					<span class="opacity-60">{data.creator.email}</span>
				{/if}
			</p>
			{#if data.submitterStanding?.requiresReview}
				<Alert type="warning" class="mt-2">
					This member's listings are checked before they publish, after a report was upheld against
					one of them.
					{#if data.submitterStanding.reason}
						Staff note: "{data.submitterStanding.reason}"
					{/if}
				</Alert>
			{/if}
		</InfoCard>
	{/if}

	<!-- Event info card -->
	<InfoCard title="Event Details">
		{#if evt.source === 'band'}
			<p class="mb-2 flex items-center gap-2 text-sm">
				<IconMusic size={16} />
				Posted by
				{#if data.band}
					<a href={resolve(`/staff/bands/${data.band.id}`)} class="link font-medium">
						{data.band.name}
					</a>
				{:else}
					<span class="font-medium">a band</span>
				{/if}
			</p>
		{/if}
		<p class="text-xl font-medium">{fullDate(evt.startsAt)}</p>
		<p class="opacity-70">
			{#if evt.doorsAt}
				Doors {formatTime(evt.doorsAt)} · Show {formatEventTimeRange(evt.startsAt, evt.endsAt)}
			{:else}
				{formatEventTimeRange(evt.startsAt, evt.endsAt)}
			{/if}
		</p>

		{#if evt.location}
			<p class="opacity-70">{evt.location}</p>
		{/if}

		{#if evt.externalTicketUrl}
			<a href={evt.externalTicketUrl} class="link text-sm" target="_blank" rel="noopener noreferrer"
				>Tickets ↗</a
			>
		{/if}

		{#if evt.description}
			<div class="mt-4 pt-4 border-t border-base-200">
				<p class="whitespace-pre-wrap">{evt.description}</p>
			</div>
		{/if}

		{#if parseTags(evt.tags).length > 0}
			<div class="mt-4 pt-4 border-t border-base-200 flex gap-1 flex-wrap">
				{#each parseTags(evt.tags) as tag (tag)}
					<Badge variant="outline">{tag}</Badge>
				{/each}
			</div>
		{/if}
	</InfoCard>

	<!-- Ticketing -->
	{#if evt.ticketingEnabled || evt.ticketPrice}
		<InfoCard title="Ticketing">
			<div class="flex gap-6">
				<div>
					<p class="text-sm opacity-60">Price</p>
					<p class="text-lg font-medium">{priceDisplay(evt).label}</p>
				</div>
				<div>
					<p class="text-sm opacity-60">Sold by</p>
					<p class="text-lg font-medium">
						{evt.ticketingEnabled ? 'Us' : evt.externalTicketUrl ? 'Off-site' : 'At the door'}
					</p>
				</div>
				{#if evt.ticketingEnabled}
					<div>
						<p class="text-sm opacity-60">Capacity</p>
						<p class="text-lg font-medium">{evt.ticketQuantity ?? 'Unlimited'}</p>
					</div>
				{/if}
				{#if data.ticketStats}
					<div>
						<p class="text-sm opacity-60">Sold</p>
						<p class="text-lg font-medium">{data.ticketStats.sold}</p>
					</div>
					<div>
						<p class="text-sm opacity-60">Remaining</p>
						<p class="text-lg font-medium">{data.ticketStats.remaining ?? '∞'}</p>
					</div>
				{/if}
			</div>

			{#if evt.status === 'published' && evt.ticketingEnabled}
				<div class="mt-3">
					<a
						href={resolve(`/events/${evt.id}/tickets`)}
						class="link link-primary text-sm"
						target="_blank"
					>
						View purchase page →
					</a>
				</div>
			{/if}

			{#if evt.status !== 'cancelled'}
				<div class="mt-4 pt-4 border-t border-base-200">
					<CompTicketsAction eventId={evt.id} />
				</div>
			{/if}
		</InfoCard>

		<!-- Ticket list -->
		{#if data.tickets.length > 0}
			<InfoCard title="Tickets ({data.tickets.length})">
				<Table>
					{#snippet head()}
						<th class="w-px"><span class="sr-only">Status</span></th>
						<th>Attendee</th>
						<th class="col-support w-px">Code</th>
					{/snippet}
					{#each data.tickets as t (t.id)}
						<tr class="hover">
							<td class="w-px"><StatusBadge status={t.status} /></td>
							<td class="cell-primary">
								<div class="truncate font-medium">{t.attendeeName}</div>
								<div class="truncate text-sm opacity-60">{t.attendeeEmail}</div>
							</td>
							<td class="col-support w-px"><span class="font-mono text-sm">{t.code}</span></td>
						</tr>
					{/each}
				</Table>
			</InfoCard>
		{/if}
	{/if}

	<!-- Poster -->
	<InfoCard title="Poster">
		{#if data.posterUrl}
			<img src={data.posterUrl} alt="Event poster" class="rounded max-h-64 object-contain" />
		{:else}
			<p class="text-sm opacity-50">No poster uploaded</p>
		{/if}

		{#if evt.status !== 'cancelled'}
			<div class="mt-3">
				<input
					type="file"
					accept="image/jpeg,image/png,image/webp"
					onchange={handlePosterUpload}
					class="file-input file-input-bordered file-input-sm"
				/>
			</div>
		{/if}
	</InfoCard>

	<!-- Linked reservation -->
	{#if data.linkedReservation}
		<InfoCard title="Space Reservation">
			<div class="flex items-center gap-3">
				<StatusBadge status={data.linkedReservation.status} />
				<span
					>{formatTime(data.linkedReservation.startsAt)} – {formatTime(
						data.linkedReservation.endsAt
					)}</span
				>
			</div>
			<div class="mt-2">
				<a
					href={resolve(`/staff/reservations/${data.linkedReservation.id}`)}
					class="link link-primary text-sm"
				>
					View reservation →
				</a>
			</div>
		</InfoCard>
	{/if}

	<!-- Creator -->
	<InfoCard title="Created by">
		<p>{data.creator.name} ({data.creator.email})</p>
		<p class="text-sm opacity-50">Created {fullDate(evt.createdAt)}</p>
	</InfoCard>
</PageContent>
