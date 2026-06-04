<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { createBandEventForm } from '$lib/remote/band-events.remote';
	import { getBandLayout } from '$lib/remote/layout.remote';
	import { page } from '$app/state';

	let layout = $derived(await getBandLayout(page.params.slug!));
	const band = $derived(layout.band);
</script>

<PageHeader title="Create Event" subtitle={band.name} />
<PageContent width="2xl">
	<form
		{...createBandEventForm.enhance(async (form) => {
			try {
				if (await form.submit()) {
					const result = createBandEventForm.result;
					toast.success('Event created');
					if (result?.eventId) goto(resolve(`/band/${band.slug}/events/${result.eventId}`));
				}
			} catch {
				toast.error('Failed to create event');
			}
		})}
		class="space-y-4"
	>
		<input {...createBandEventForm.fields.slug.as('hidden', band.slug)} />

		<div class="form-control">
			<label class="label" for="title"><span class="label-text">Title *</span></label>
			<input
				{...createBandEventForm.fields.title.as('text')}
				class="input input-bordered w-full"
				placeholder="e.g. Live at The Venue"
				maxlength="200"
				id="title"
			/>
			{#each createBandEventForm.fields.title.issues() as issue, i (i)}
				<p class="text-error text-sm mt-1">{issue.message}</p>
			{/each}
		</div>

		<div class="form-control">
			<label class="label" for="description"><span class="label-text">Description</span></label>
			<textarea
				{...createBandEventForm.fields.description.as('text')}
				class="textarea textarea-bordered w-full"
				rows="4"
				maxlength="5000"
				placeholder="Tell people what to expect..."
				id="description"
			></textarea>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			<div class="form-control">
				<label class="label" for="eventDate"><span class="label-text">Date *</span></label>
				<input
					{...createBandEventForm.fields.eventDate.as('date')}
					class="input input-bordered w-full"
					id="eventDate"
					required
				/>
			</div>
			<div class="form-control">
				<label class="label" for="eventStartTime"
					><span class="label-text">Start Time *</span></label
				>
				<input
					{...createBandEventForm.fields.eventStartTime.as('time')}
					class="input input-bordered w-full"
					id="eventStartTime"
					required
				/>
			</div>
			<div class="form-control">
				<label class="label" for="eventEndTime"><span class="label-text">End Time *</span></label>
				<input
					{...createBandEventForm.fields.eventEndTime.as('time')}
					class="input input-bordered w-full"
					id="eventEndTime"
					required
				/>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div class="form-control">
				<label class="label" for="doorsTime"><span class="label-text">Doors Open</span></label>
				<input
					{...createBandEventForm.fields.doorsTime.as('time')}
					class="input input-bordered w-full"
					id="doorsTime"
				/>
			</div>
			<div class="form-control">
				<label class="label" for="location"><span class="label-text">Location</span></label>
				<input
					{...createBandEventForm.fields.location.as('text')}
					class="input input-bordered w-full"
					placeholder="Venue name & address"
					maxlength="500"
					id="location"
				/>
			</div>
		</div>

		<div class="form-control">
			<label class="label" for="tags"><span class="label-text">Tags</span></label>
			<input
				{...createBandEventForm.fields.tags.as('text')}
				class="input input-bordered w-full"
				placeholder="Comma-separated tags"
				maxlength="500"
				id="tags"
			/>
		</div>

		<div class="form-control">
			<label class="label" for="externalTicketUrl"
				><span class="label-text">Ticket Link (external)</span></label
			>
			<input
				{...createBandEventForm.fields.externalTicketUrl.as('text')}
				class="input input-bordered w-full"
				placeholder="https://eventbrite.com/..."
				id="externalTicketUrl"
			/>
		</div>

		<div class="flex justify-end pt-4">
			<button class="btn btn-primary">Create Event</button>
		</div>
	</form>
</PageContent>
