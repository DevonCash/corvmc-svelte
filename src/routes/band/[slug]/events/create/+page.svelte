<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createBandEventForm } from '$lib/remote/band-events.remote';
	import { getBandLayout } from '$lib/remote/layout.remote';
	import { page } from '$app/state';

	// Declared before the awaited query below: a declaration that follows a
	// top-level await is async-gated, which would compile every `fields.X.as()`
	// below into an async derived (the churn behind JAVASCRIPT-SVELTEKIT-W).
	const fields = createBandEventForm.fields;

	let layout = $derived(await getBandLayout(page.params.slug!));
	const band = $derived(layout.band);
</script>

<PageHeader title="Create Event" subtitle={band.name} />
<PageContent width="2xl">
	<Form
		remote={createBandEventForm}
		successToast="Event created"
		onsuccess={(result) => {
			if (result?.eventId) goto(resolve(`/band/${band.slug}/events/${result.eventId}`));
		}}
		class="space-y-4"
	>
		<input {...fields.slug.as('hidden', band.slug)} />

		<FormField
			field={fields.title}
			type="text"
			label="Title *"
			placeholder="e.g. Live at The Venue"
			maxlength="200"
		/>

		<!-- Custom input mode: FormField's built-in textarea drops `rest`, so rows,
		     maxlength and placeholder would be lost. Issues still resolve by name. -->
		<FormField name="description" label="Description">
			<textarea
				{...fields.description.as('text')}
				class="textarea textarea-bordered w-full"
				rows="4"
				maxlength="5000"
				placeholder="Tell people what to expect..."
			></textarea>
		</FormField>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			<FormField field={fields.eventDate} type="date" label="Date *" required />
			<FormField field={fields.eventStartTime} type="time" label="Start Time *" required />
			<FormField field={fields.eventEndTime} type="time" label="End Time *" required />
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<FormField field={fields.doorsTime} type="time" label="Doors Open" />
			<FormField
				field={fields.location}
				type="text"
				label="Location"
				placeholder="Venue name & address"
				maxlength="500"
			/>
		</div>

		<FormField
			field={fields.tags}
			type="text"
			label="Tags"
			placeholder="Comma-separated tags"
			maxlength="500"
		/>

		<FormField
			field={fields.externalTicketUrl}
			type="text"
			label="Ticket Link (external)"
			placeholder="https://eventbrite.com/..."
		/>

		<div class="flex justify-end pt-4">
			<SubmitButton label="Create Event" class="btn-primary" />
		</div>
	</Form>
</PageContent>
