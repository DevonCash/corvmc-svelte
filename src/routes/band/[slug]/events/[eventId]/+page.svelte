<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { invalidateAll } from '$app/navigation';
	import { formatDate, formatTime, formatCents } from '$lib/utils/format';
	import { centsToDollars } from '$lib/utils/event-ticketing';
	import {
		getBandEventDetail,
		updateBandEventForm,
		publishBandEvent,
		unpublishBandEvent,
		cancelBandEventForm
	} from '$lib/remote/band-events.remote';
	import { getBandLayout } from '$lib/remote/layout.remote';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	// Declared before the awaited queries below: a declaration that follows a
	// top-level await is async-gated, which would compile every `fields.X.as()`
	// below into an async derived (the churn behind JAVASCRIPT-SVELTEKIT-W).
	const updateFields = updateBandEventForm.fields;
	const publishFields = publishBandEvent.fields;
	const unpublishFields = unpublishBandEvent.fields;
	const cancelFields = cancelBandEventForm.fields;

	let layout = $derived(await getBandLayout(page.params.slug!));
	let evt = $derived(
		await getBandEventDetail({ slug: page.params.slug!, eventId: page.params.eventId! })
	);
	const band = $derived(layout.band);
	const isAdmin = $derived(layout.userRole === 'owner' || layout.userRole === 'admin');

	let editing = $state(false);

	// Gates the price/capacity block inside the edit form. Seeded from the event
	// each time the form opens rather than derived from it, so an unsaved toggle
	// survives until the band either submits or closes the form.
	let ticketingEnabled = $state(false);

	function toggleEditing() {
		if (!editing) ticketingEnabled = evt.ticketingEnabled;
		editing = !editing;
	}
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
						<dd>{formatTime(evt.startsAt)}–{formatTime(evt.endsAt)}</dd>
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

				{#if evt.description}
					<div class="mt-4 border-t pt-4">
						<p class="whitespace-pre-wrap text-sm">{evt.description}</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- Ticketing -->
		{#if evt.ticketingEnabled}
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body">
					<h2 class="text-xs font-medium uppercase opacity-60">Ticketing</h2>
					<div class="flex flex-wrap gap-6">
						<div>
							<p class="text-sm opacity-60">Price</p>
							<p class="text-lg font-medium">{formatCents(evt.ticketPrice ?? 0)}</p>
						</div>
						<div>
							<p class="text-sm opacity-60">Capacity</p>
							<p class="text-lg font-medium">{evt.ticketQuantity ?? 'Unlimited'}</p>
						</div>
						<div>
							<p class="text-sm opacity-60">Sold</p>
							<p class="text-lg font-medium">{evt.ticketsSold}</p>
						</div>
						<div>
							<p class="text-sm opacity-60">Remaining</p>
							<p class="text-lg font-medium">{evt.ticketsRemaining ?? '∞'}</p>
						</div>
					</div>

					{#if evt.status === 'published'}
						<div class="mt-3">
							<a href={resolve(`/events/${evt.id}/tickets`)} class="link link-primary text-sm">
								View purchase page →
							</a>
						</div>
					{/if}

					<p class="mt-3 text-sm opacity-60">
						Ticket sales are collected by CMC. Contact staff about payouts, refunds, or comping
						someone in.
					</p>
				</div>
			</div>
		{/if}

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

				<Button class="btn-ghost btn-sm" onclick={toggleEditing}>
					{editing ? 'Done Editing' : 'Edit'}
				</Button>
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

						<FormField
							name="ticketingEnabled"
							type="toggle"
							label="Ticketing"
							checkboxLabel="Sell tickets through CMC"
							bind:value={ticketingEnabled}
						/>

						{#if ticketingEnabled}
							<div class="card bg-base-100 p-4">
								<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
									<FormField
										field={updateFields.ticketPriceDollars}
										type="number"
										label="Ticket price ($)"
										value={centsToDollars(evt.ticketPrice)}
										min="0.01"
										step="0.01"
										placeholder="15.00"
									/>
									<FormField
										field={updateFields.ticketQuantity}
										type="number"
										label="Capacity"
										value={evt.ticketQuantity ? String(evt.ticketQuantity) : ''}
										min="1"
										step="1"
										placeholder="Unlimited"
									/>
								</div>
								<p class="text-sm opacity-60 mt-2">Leave capacity blank for unlimited tickets.</p>
							</div>
						{/if}

						<div class="flex justify-end pt-2">
							<SubmitButton label="Save Changes" class="btn-primary" />
						</div>
					</Form>
				</div>
			</div>
		{/if}
	</div>
</PageContent>
