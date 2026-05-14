<script lang="ts">
	import type { PageServerData } from './$types';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import AsyncButton from '$lib/components/AsyncButton.svelte';
	import FormField from '$lib/components/FormField.svelte';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { publishEvent, cancelEvent, updateEvent, checkRebook, checkConflicts } from './data.remote';
	import InfoCard from '$lib/components/InfoCard.svelte';
	import { fullDate, formatTime, toLocalDate, toLocalTime } from '$lib/utils/format';

	let { data }: { data: PageServerData } = $props();

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
	let saving = $state(false);

	// Rebook state
	let rebookNeeded = $state(false);
	let rebookReason = $state('');
	let rebookConfirmed = $state(false);
	let overrideConflicts = $state(false);

	// Conflict checking for reservation times
	const conflictData = $derived(
		rebookConfirmed && editReservationStartTime && editReservationEndTime && editDate
			? await checkConflicts({
					date: editDate,
					startTime: editReservationStartTime,
					endTime: editReservationEndTime,
					excludeReservationId: data.linkedReservation?.id
				})
			: null
	);

	const conflictWarnings = $derived.by(() => {
		if (!conflictData) return [];
		const msgs: string[] = [];
		for (const c of conflictData.conflicts) {
			if (c.type === 'reservation') {
				msgs.push(`Conflicts with reservation: ${c.label}`);
			} else {
				msgs.push(`Overlaps with closure: ${c.label}`);
			}
		}
		msgs.push(...conflictData.validationWarnings);
		return msgs;
	});

	function startEditing() {
		editTitle = evt.title;
		editDescription = evt.description ?? '';
		editTags = evt.tags ?? '';

		// Parse existing dates into form values
		editDate = toLocalDate(evt.startsAt);
		editStartTime = toLocalTime(evt.startsAt);
		editEndTime = toLocalTime(evt.endsAt);
		editDoorsTime = evt.doorsAt ? toLocalTime(evt.doorsAt) : '';

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

	async function saveEdits() {
		if (!editTitle || !editDate || !editStartTime || !editEndTime) return;
		saving = true;

		try {
			await updateEvent({
				eventId: evt.id,
				title: editTitle,
				description: editDescription || null,
				tags: editTags || null,
				eventDate: editDate,
				eventStartTime: editStartTime,
				eventEndTime: editEndTime,
				doorsTime: editDoorsTime || null,
				rebookReservation: rebookNeeded && rebookConfirmed,
				reservationStartTime: editReservationStartTime || undefined,
				reservationEndTime: editReservationEndTime || undefined,
				overrideConflicts
			});
			toast.success('Updated');
			editing = false;
			rebookNeeded = false;
			rebookConfirmed = false;
			await invalidateAll();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to update');
		} finally {
			saving = false;
		}
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

<div class="max-w-3xl mx-auto space-y-6">
	<PageHeader title={evt.title} backHref="/staff/events">
		<div class="flex items-center gap-2">
			{#if evt.status !== 'cancelled' && !editing}
				<button class="btn btn-sm btn-ghost" onclick={startEditing}>Edit</button>
			{/if}

			{#if evt.status === 'draft'}
				<AsyncButton
					action={async () => { await publishEvent({ eventId: evt.id }); }}
					label="Publish"
					successToast="Published"
					class="btn-success btn-sm"
					onsuccess={() => invalidateAll()}
				/>
			{/if}

			{#if evt.status !== 'cancelled'}
				<AsyncButton
					action={async () => { await cancelEvent({ eventId: evt.id }); }}
					label="Cancel Event"
					successToast="Cancelled"
					class="btn-error btn-outline btn-sm"
					onsuccess={() => invalidateAll()}
				/>
			{/if}
		</div>
	</PageHeader>

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

					<FormField label="Title" id="editTitle" issues={[]}>
						<input id="editTitle" type="text" bind:value={editTitle} class="input input-bordered w-full" required />
					</FormField>

					<FormField label="Description" id="editDesc" issues={[]}>
						<textarea id="editDesc" bind:value={editDescription} class="textarea textarea-bordered w-full" rows="4"></textarea>
					</FormField>

					<FormField label="Date" id="editDate" issues={[]}>
						<input id="editDate" type="date" bind:value={editDate} class="input input-bordered w-full" required onchange={checkForRebook} />
					</FormField>

					<div class="grid grid-cols-2 gap-4">
						<FormField label="Start time" id="editStartTime" issues={[]}>
							<input id="editStartTime" type="time" bind:value={editStartTime} class="input input-bordered w-full" required onchange={checkForRebook} />
						</FormField>

						<FormField label="End time" id="editEndTime" issues={[]}>
							<input id="editEndTime" type="time" bind:value={editEndTime} class="input input-bordered w-full" required onchange={checkForRebook} />
						</FormField>
					</div>

					<FormField label="Doors time" id="editDoorsTime" issues={[]}>
						<input id="editDoorsTime" type="time" bind:value={editDoorsTime} class="input input-bordered w-full" />
					</FormField>

					<FormField label="Tags" id="editTags" issues={[]}>
						<input id="editTags" type="text" bind:value={editTags} class="input input-bordered w-full" placeholder="e.g. open mic, workshop" />
					</FormField>

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
											<input id="editResStart" type="time" bind:value={editReservationStartTime} class="input input-bordered w-full" />
										</FormField>
										<FormField label="Reservation end" id="editResEnd" issues={[]}>
											<input id="editResEnd" type="time" bind:value={editReservationEndTime} class="input input-bordered w-full" />
										</FormField>
									</div>

									{#if conflictWarnings.length > 0}
										<div class="space-y-1 mt-2">
											{#each conflictWarnings as warning, i (i)}
												<div class="alert alert-error text-sm py-2">{warning}</div>
											{/each}
											<label class="label cursor-pointer justify-start gap-3">
												<input type="checkbox" bind:checked={overrideConflicts} class="checkbox checkbox-sm" />
												<span class="label-text">Override conflicts</span>
											</label>
										</div>
									{/if}
								{/if}
							</div>
						</div>
					{/if}

					<div class="flex justify-end gap-2 pt-2">
						<button class="btn btn-ghost btn-sm" onclick={cancelEditing}>Cancel</button>
						<button
							class="btn btn-primary btn-sm"
							disabled={saving || !editTitle || !editDate || !editStartTime || !editEndTime || (rebookNeeded && !rebookConfirmed) || (conflictWarnings.length > 0 && !overrideConflicts)}
							onclick={saveEdits}
						>
							{#if saving}
								<span class="loading loading-spinner loading-sm"></span>
							{/if}
							Save
						</button>
					</div>
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
					<span class="badge badge-outline badge-sm">{tag}</span>
				{/each}
			</div>
		{/if}
	</InfoCard>

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
</div>
