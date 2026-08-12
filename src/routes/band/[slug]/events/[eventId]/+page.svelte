<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import LineupEditor, { type LineupChip } from '../LineupEditor.svelte';
	import { invalidateAll } from '$app/navigation';
	import { formatDate, formatTime, toLocalDate, toLocalTime } from '$lib/utils/format';
	import { formatEventTimeRange } from '$lib/utils/event-time';
	import { priceDisplay } from '$lib/utils/event-ticketing';
	import {
		getBandEventDetail,
		updateBandEventForm,
		publishBandEvent,
		unpublishBandEvent,
		cancelBandEventForm,
		removeBandEventPoster
	} from '$lib/remote/band-events.remote';
	import { getBandLayout } from '$lib/remote/layout.remote';
	import { page } from '$app/state';

	// Declared before the awaited queries below: a declaration that follows a
	// top-level await is async-gated, which would compile every `fields.X.as()`
	// below into an async derived (the churn behind JAVASCRIPT-SVELTEKIT-W).
	const updateFields = updateBandEventForm.fields;
	const publishFields = publishBandEvent.fields;
	const unpublishFields = unpublishBandEvent.fields;
	const cancelFields = cancelBandEventForm.fields;
	const posterFields = removeBandEventPoster.fields;

	let layout = $derived(await getBandLayout(page.params.slug!));
	let evt = $derived(
		await getBandEventDetail({ slug: page.params.slug!, eventId: page.params.eventId! })
	);
	const band = $derived(layout.band);
	const isAdmin = $derived(layout.userRole === 'owner' || layout.userRole === 'admin');

	let editing = $state(false);

	// Seeded from the saved bill so an edit that doesn't touch the lineup
	// round-trips it unchanged rather than wiping it. Writable derived: edits
	// stick, but reloading the event resets to what the server has.
	let lineup = $derived<LineupChip[]>(
		evt.lineup.map((l) => ({
			name: l.name,
			bandId: l.bandId ?? undefined,
			status: l.status
		}))
	);
</script>

<PageHeader title={evt.title} subtitle={band.name}>
	<StatusBadge status={evt.status} />
</PageHeader>
<PageContent width="2xl">
	<div class="space-y-6">
		<!-- Event details -->
		<div class="card bg-base-100 shadow-sm">
			<div class="card-body">
				<dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<dt class="text-xs font-medium uppercase opacity-60">Date</dt>
						<dd>{formatDate(evt.startsAt)}</dd>
					</div>
					<div>
						<dt class="text-xs font-medium uppercase opacity-60">Time</dt>
						<dd>{formatEventTimeRange(evt.startsAt, evt.endsAt)}</dd>
					</div>
					{#if evt.doorsAt}
						<div>
							<dt class="text-xs font-medium uppercase opacity-60">Doors</dt>
							<dd>{formatTime(evt.doorsAt)}</dd>
						</div>
					{/if}
					{#if evt.location}
						<div>
							<dt class="text-xs font-medium uppercase opacity-60">Location</dt>
							<dd>{evt.location}</dd>
						</div>
					{/if}
					<div>
						<dt class="text-xs font-medium uppercase opacity-60">Price</dt>
						<!-- Band gigs never sell through our checkout. -->
						<dd>{priceDisplay({ ...evt, ticketingEnabled: false }).label}</dd>
					</div>
					{#if evt.externalTicketUrl}
						<div class="sm:col-span-2">
							<dt class="text-xs font-medium uppercase opacity-60">Ticket Link</dt>
							<dd>
								<a
									href={evt.externalTicketUrl}
									target="_blank"
									rel="noopener external"
									class="link link-primary"
								>
									{evt.externalTicketUrl}
								</a>
							</dd>
						</div>
					{/if}
				</dl>

				{#if evt.lineup.length > 1}
					<div class="mt-4 border-t pt-4">
						<p class="text-xs font-medium uppercase opacity-60">Bill</p>
						<ul class="mt-1 space-y-1">
							{#each evt.lineup as act (act.id)}
								<li class="flex items-center gap-2 text-sm">
									<span>{act.name}</span>
									{#if act.status === 'pending'}
										<span class="badge badge-warning badge-xs">awaiting reply</span>
									{:else if act.status === 'declined'}
										<span class="badge badge-ghost badge-xs">declined</span>
									{/if}
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if evt.description}
					<div class="mt-4 border-t pt-4">
						<p class="whitespace-pre-wrap text-sm">{evt.description}</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- Actions -->
		{#if isAdmin && evt.status !== 'cancelled'}
			<div class="flex flex-wrap items-center gap-2">
				{#if evt.status === 'draft'}
					<Form
						remote={publishBandEvent}
						successToast="Event published"
						onsuccess={() => invalidateAll()}
					>
						<input {...publishFields.slug.as('hidden', band.slug)} />
						<input {...publishFields.eventId.as('hidden', evt.id)} />
						<SubmitButton label="Publish" class="btn-primary btn-sm" />
					</Form>
				{:else if evt.status === 'published'}
					<Form
						remote={unpublishBandEvent}
						successToast="Event unpublished"
						onsuccess={() => invalidateAll()}
					>
						<input {...unpublishFields.slug.as('hidden', band.slug)} />
						<input {...unpublishFields.eventId.as('hidden', evt.id)} />
						<SubmitButton label="Unpublish" class="btn-ghost btn-sm" />
					</Form>
				{/if}

				<Form
					remote={cancelBandEventForm}
					successToast="Event cancelled"
					onsuccess={() => invalidateAll()}
				>
					<input {...cancelFields.slug.as('hidden', band.slug)} />
					<input {...cancelFields.eventId.as('hidden', evt.id)} />
					<SubmitButton label="Cancel Event" class="btn-error btn-outline btn-sm" />
				</Form>

				<Button class="btn-ghost btn-sm" onclick={() => (editing = !editing)}>
					{editing ? 'Done Editing' : 'Edit'}
				</Button>

				{#if evt.posterUrl}
					<Form
						remote={removeBandEventPoster}
						successToast="Poster removed"
						onsuccess={() => invalidateAll()}
						class="inline"
					>
						<input {...posterFields.slug.as('hidden', band.slug)} />
						<input {...posterFields.eventId.as('hidden', evt.id)} />
						<SubmitButton label="Remove Poster" class="btn-ghost btn-sm" />
					</Form>
				{/if}
			</div>
		{/if}

		<!-- Edit form (toggle) -->
		{#if editing && isAdmin}
			<div class="card bg-base-200 shadow-sm">
				<div class="card-body">
					<Form
						remote={updateBandEventForm}
						guard
						successToast="Event updated"
						onsuccess={() => {
							editing = false;
							invalidateAll();
						}}
						class="space-y-4"
					>
						<input {...updateFields.slug.as('hidden', band.slug)} />
						<input {...updateFields.eventId.as('hidden', evt.id)} />

						<FormField
							field={updateFields.title}
							type="text"
							label="Title"
							value={evt.title}
							maxlength="200"
						/>

						<!-- Custom input mode: FormField's built-in textarea drops `rest`, so
						     rows and maxlength would be lost. Issues still resolve by name. -->
						<FormField name="description" label="Description">
							<textarea
								{...updateFields.description.as('text', evt.description ?? '')}
								class="textarea textarea-bordered w-full"
								rows="4"
								maxlength="5000"
							></textarea>
						</FormField>

						<!-- The whole point of the edit form for backfill: without these a
						     band could never correct the date of a gig it entered. -->
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
							<FormField
								field={updateFields.eventDate}
								type="date"
								label="Date"
								value={toLocalDate(evt.startsAt)}
							/>
							<FormField
								field={updateFields.eventStartTime}
								type="time"
								label="Start Time"
								value={toLocalTime(evt.startsAt)}
							/>
							<FormField
								field={updateFields.eventEndTime}
								type="time"
								label="End Time"
								value={evt.endsAt ? toLocalTime(evt.endsAt) : ''}
								description="Optional — clear it if you don't know."
							/>
						</div>

						<FormField
							field={updateFields.doorsTime}
							type="time"
							label="Doors Open"
							value={evt.doorsAt ? toLocalTime(evt.doorsAt) : ''}
						/>

						<FormField
							field={updateFields.location}
							type="text"
							label="Location"
							value={evt.location ?? ''}
							maxlength="500"
						/>

						<FormField
							field={updateFields.externalTicketUrl}
							type="text"
							label="Ticket Link"
							value={evt.externalTicketUrl ?? ''}
						/>

						<!-- `type="text"` with a decimal inputmode, not `type="number"`: a
						     number FormField registers as `n:` and SvelteKit would hand the
						     handler a number, which `ticketPriceDollars: z.string()` rejects. -->
						<FormField
							field={updateFields.ticketPriceDollars}
							type="text"
							label="Ticket price ($)"
							value={evt.ticketPrice ? (evt.ticketPrice / 100).toFixed(2) : ''}
							placeholder="10.00"
							inputmode="decimal"
							description="What people pay, at the door or through the link. Leave blank if it's free."
						/>

						<FormField name="lineup" label="Who's playing">
							<LineupEditor bind:value={lineup} ownerBandId={band.id} />
						</FormField>

						<FormField name="posterFile" label="Poster">
							{#if evt.posterUrl}
								<img
									src={evt.posterUrl}
									alt="Current poster"
									class="mb-2 h-32 w-32 rounded object-cover"
								/>
							{/if}
							<input
								{...updateFields.posterFile.as('file')}
								accept="image/jpeg,image/png,image/webp"
								class="file-input file-input-bordered w-full"
							/>
						</FormField>

						<div class="flex justify-end pt-2">
							<SubmitButton label="Save Changes" class="btn-primary" />
						</div>
					</Form>
				</div>
			</div>
		{/if}
	</div>
</PageContent>
