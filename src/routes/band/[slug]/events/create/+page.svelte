<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Form, { Field } from '$lib/components/shared/Form';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { createBandEventForm } from '$lib/remote/band-events.remote';
	import { getBandLayout } from '$lib/remote/layout.remote';
	import { page } from '$app/state';

	let layout = $derived(await getBandLayout(page.params.slug!));
	const band = $derived(layout.band);
	const { fields } = createBandEventForm;
</script>

<PageHeader title="Create Event" subtitle={band.name} />
<PageContent width="lg">
	<Form
		action={createBandEventForm}
		onSuccess={(result) => {
			toast.success('Event created');
			goto(`/band/${band.slug}/events/${result.eventId}`);
		}}
	>
		<input type="hidden" name={fields.slug} value={band.slug} />

		<Field name={fields.title} label="Title" required>
			<input type="text" name={fields.title} class="input input-bordered w-full" placeholder="e.g. Live at The Venue" maxlength="200" />
		</Field>

		<Field name={fields.description} label="Description">
			<textarea name={fields.description} class="textarea textarea-bordered w-full" rows="4" maxlength="5000" placeholder="Tell people what to expect..." />
		</Field>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			<Field name={fields.eventDate} label="Date" required>
				<input type="date" name={fields.eventDate} class="input input-bordered w-full" required />
			</Field>
			<Field name={fields.eventStartTime} label="Start Time" required>
				<input type="time" name={fields.eventStartTime} class="input input-bordered w-full" required />
			</Field>
			<Field name={fields.eventEndTime} label="End Time" required>
				<input type="time" name={fields.eventEndTime} class="input input-bordered w-full" required />
			</Field>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<Field name={fields.doorsTime} label="Doors Open">
				<input type="time" name={fields.doorsTime} class="input input-bordered w-full" />
			</Field>
			<Field name={fields.location} label="Location">
				<input type="text" name={fields.location} class="input input-bordered w-full" placeholder="Venue name & address" maxlength="500" />
			</Field>
		</div>

		<Field name={fields.tags} label="Tags">
			<input type="text" name={fields.tags} class="input input-bordered w-full" placeholder="Comma-separated tags" maxlength="500" />
		</Field>

		<Field name={fields.externalTicketUrl} label="Ticket Link (external)">
			<input type="url" name={fields.externalTicketUrl} class="input input-bordered w-full" placeholder="https://eventbrite.com/..." />
		</Field>

		<div class="flex justify-end pt-4">
			<SubmitButton>Create Event</SubmitButton>
		</div>
	</Form>
</PageContent>
