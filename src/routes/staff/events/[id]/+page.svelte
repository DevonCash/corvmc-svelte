<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { PublishEventAction, UnpublishEventAction, CancelEventAction, CompTicketsAction } from '$lib/components/shared/actions';
	import { updateEvent, checkRebook, checkConflicts } from '$lib/remote/events.remote';
	import ConflictWarnings from '$lib/components/shared/reservations/ConflictWarnings.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import { fullDate, formatTime, toLocalDate, toLocalTime, formatCents } from '$lib/utils/format';
	import Badge from '$lib/components/shared/Badge.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import type { StaffEventDetailResponse } from '$lib/server/db/schema/api';

	let { data }: { data: StaffEventDetailResponse } = $props();

	const evt = $derived(data.event);

	// ── Edit state ────────────────────────────────────────────────────────
	let editing = $state(false);
	let editTitle = $state('');
	let editDescription = $state('');
	let editTags = $state('');
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

	// Compute ticket price in cents for hidden field
	const editTicketPriceCents = $derived(
		editTicketingEnabled && editTicketPriceDollars
			? String(Math.round(parseFloat(editTicketPriceDollars) * 100))
			: ''
	);

	function startEditing() {
		editTitle = evt.title;
		editDescription = evt.description ?? '';
		editTags = evt.tags ?? '';

		// Parse existing dates into form values
		editDate = toLocalDate(evt.startsAt);
		editStartTime = toLocalTime(evt.startsAt);
		editEndTime = toLocalTime(evt.endsAt);
		editDoorsTime = evt.doorsAt ? toLocalTime(evt.doorsAt) : '';

		// Pre-fill ticketing fields
		editTicketingEnabled = evt.ticketingEnabled;
		editTicketPriceDollars = evt.ticketPrice ? (evt.ticketPrice / 100).toFixed(2) : '';
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

		const tz = 'America/Los_Angeles';
		const newStartsAt = buildISOFromLocal(editDate, editStartTime, tz);
		const newEndsAt = buildISOFromLocal(editDate, editEndTime, tz);

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
		await invalidateAll();
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
			if (!res.ok) throw new Error('Upload failed');
			toast.success('Poster updated');
			await invalidateAll();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to upload poster');
		}
	}

	// ── Helpers ───────────────────────────────────────────────────────────

	function buildISOFromLocal(date: string, time: string, _tz: string): string {
		// Build a rough ISO string for the rebook check query
		// The server will parse with proper timezone handling
		return new Date(`${date}T${time}:00`).toISOString();
	}

	function parseTags(tags: string | null): string[] {
		if (!tags) return [];
		return tags.split(',').map((t) => t.trim()).filter(Boolean);
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

			{#if evt.status === 'published'}
				<UnpublishEventAction eventId={evt.id} />
			{/if}

			{#if evt.status !== 'cancelled'}
				<CancelEventAction eventId={evt.id} />
			{/if}
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

	<!-- Edit form -->
	{#if editing}
		<svelte:boundary>
			<div class="card bg-base-100 shadow">
				<div class="card-body space-y-4">
					<h3 class="text-sm font-medium opacity-60">Edit Event</h3>

					<Form remote={updateEvent} successToast="Updated" onsuccess={handleUpdateSuccess}>
						<input type="hidden" name="eventId" value={evt.id} />
						<input type="hidden" name="ticketingEnabled" value={editTicketingEnabled ? 'on' : 'off'} />
						{#if editTicketingEnabled}
							<input type="hidden" name="ticketPrice" value={editTicketPriceCents} />
						{/if}
						{#if rebookNeeded && rebookConfirmed}
							<input type="hidden" name="rebookReservation" value="on" />
						{/if}
						{#if overrideConflicts}
							<input type="hidden" name="overrideConflicts" value="on" />
						{/if}

						<div class="space-y-4">
							<FormField label="Title" id="editTitle" issues={[]}>
								<input id="editTitle" name="title" type="text" bind:value={editTitle} class="input input-bordered w-full" required />
							</FormField>

							<FormField label="Description" id="editDesc" issues={[]}>
								<textarea id="editDesc" name="description" bind:value={editDescription} class="textarea textarea-bordered w-full" rows="4"></textarea>
							</FormField>

							<FormField label="Date" id="editDate" issues={[]}>
								<input id="editDate" name="eventDate" type="date" bind:value={editDate} class="input input-bordered w-full" required onchange={checkForRebook} />
							</FormField>

							<div class="grid grid-cols-2 gap-4">
								<FormField label="Start time" id="editStartTime" issues={[]}>
									<input id="editStartTime" name="eventStartTime" type="time" bind:value={editStartTime} class="input input-bordered w-full" required onchange={checkForRebook} />
								</FormField>

								<FormField label="End time" id="editEndTime" issues={[]}>
									<input id="editEndTime" name="eventEndTime" type="time" bind:value={editEndTime} class="input input-bordered w-full" required onchange={checkForRebook} />
								</FormField>
							</div>

							<FormField label="Doors time" id="editDoorsTime" issues={[]}>
								<input id="editDoorsTime" name="doorsTime" type="time" bind:value={editDoorsTime} class="input input-bordered w-full" />
							</FormField>

							<FormField label="Tags" id="editTags" issues={[]}>
								<input id="editTags" name="tags" type="text" bind:value={editTags} class="input input-bordered w-full" placeholder="e.g. open mic, workshop" />
							</FormField>

							<!-- Ticketing -->
							<div class="form-control">
								<label class="label cursor-pointer justify-start gap-3">
									<input type="checkbox" bind:checked={editTicketingEnabled} class="toggle" />
									<span class="label-text">Enable ticketing</span>
								</label>
							</div>

							{#if editTicketingEnabled}
								<div class="card bg-base-200 p-4">
									<div class="grid grid-cols-2 gap-4">
										<FormField label="Ticket price ($)" id="editTicketPrice" issues={[]}>
											<input
												id="editTicketPrice"
												type="number"
												bind:value={editTicketPriceDollars}
												min="0.01"
												step="0.01"
												placeholder="15.00"
												class="input input-bordered w-full"
												required
											/>
										</FormField>

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
									</div>
									<p class="text-sm opacity-60 mt-2">Leave capacity blank for unlimited tickets.</p>
								</div>
							{/if}

							<!-- Rebook warning -->
							{#if rebookNeeded}
								<div class="alert alert-warning">
									<div class="w-full space-y-3">
										<p class="font-medium">Reservation needs rebooking</p>
										<p class="text-sm">{rebookReason}. The existing reservation will be cancelled and a new one created.</p>

										<label class="label cursor-pointer justify-start gap-3">
											<input type="checkbox" bind:checked={rebookConfirmed} class="checkbox checkbox-sm" />
											<span class="label-text">Confirm rebook</span>
										</label>

										{#if rebookConfirmed}
											<div class="grid grid-cols-2 gap-4 mt-2">
												<FormField label="Reservation start" id="editResStart" issues={[]}>
													<input id="editResStart" name="reservationStartTime" type="time" bind:value={editReservationStartTime} class="input input-bordered w-full" />
												</FormField>
												<FormField label="Reservation end" id="editResEnd" issues={[]}>
													<input id="editResEnd" name="reservationEndTime" type="time" bind:value={editReservationEndTime} class="input input-bordered w-full" />
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
													<input type="checkbox" bind:checked={overrideConflicts} class="checkbox checkbox-sm" />
													<span class="label-text">Override conflicts</span>
												</label>
											{/if}
										{/if}
									</div>
								</div>
							{/if}

							<div class="flex justify-end gap-2 pt-2">
								<Button type="button" class="btn-ghost btn-sm" onclick={cancelEditing}>Cancel</Button>
								<SubmitButton
									label="Save"
									class="btn-primary btn-sm"
								/>
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

	<!-- Event info card -->
	<InfoCard title="Event Details">
		<p class="text-xl font-medium">{fullDate(evt.startsAt)}</p>
		<p class="opacity-70">
			{#if evt.doorsAt}
				Doors {formatTime(evt.doorsAt)} · Show {formatTime(evt.startsAt)} – {formatTime(evt.endsAt)}
			{:else}
				{formatTime(evt.startsAt)} – {formatTime(evt.endsAt)}
			{/if}
		</p>

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
	{#if evt.ticketingEnabled}
		<InfoCard title="Ticketing">
			<div class="flex gap-6">
				<div>
					<p class="text-sm opacity-60">Price</p>
					<p class="text-lg font-medium">{formatCents(evt.ticketPrice!)}</p>
				</div>
				<div>
					<p class="text-sm opacity-60">Capacity</p>
					<p class="text-lg font-medium">{evt.ticketQuantity ?? 'Unlimited'}</p>
				</div>
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

			{#if evt.status === 'published'}
				<div class="mt-3">
					<a href="/events/{evt.id}/tickets" class="link link-primary text-sm" target="_blank">
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
				<DataTable data={data.tickets} empty="No tickets">
					<Column key="attendeeName" header="Name" sortable />
					<Column key="attendeeEmail" header="Email">
						{#snippet cell(_, t)}
							<span class="text-sm opacity-70">{t.attendeeEmail}</span>
						{/snippet}
					</Column>
					<Column key="code" header="Code" shrink>
						{#snippet cell(_, t)}
							<span class="font-mono text-sm">{t.code}</span>
						{/snippet}
					</Column>
					<Column key="status" header="Status" shrink>
						{#snippet cell(_, t)}
							<StatusBadge status={t.status} />
						{/snippet}
					</Column>
				</DataTable>
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
				<span>{formatTime(data.linkedReservation.startsAt)} – {formatTime(data.linkedReservation.endsAt)}</span>
			</div>
			<div class="mt-2">
				<a href="/staff/reservations/{data.linkedReservation.id}" class="link link-primary text-sm">
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
