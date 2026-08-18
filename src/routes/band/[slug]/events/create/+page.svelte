<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import LineupEditor, { type LineupChip } from '../LineupEditor.svelte';
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

	// The owner always heads its own bill; the server writes that slot too, but
	// showing it here makes the running order legible while editing.
	let lineup = $state<LineupChip[]>([]);
	$effect(() => {
		if (lineup.length === 0 && band) {
			lineup = [{ name: band.name, bandId: band.id, status: 'confirmed' }];
		}
	});
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
				class="textarea w-full"
				rows="4"
				maxlength="5000"
				placeholder="Tell people what to expect..."
			></textarea>
		</FormField>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			<FormField field={fields.eventDate} type="date" label="Date *" required />
			<FormField field={fields.eventStartTime} type="time" label="Start Time *" required />
			<FormField
				field={fields.eventEndTime}
				type="time"
				label="End Time"
				description="Optional — leave blank if you don't know."
			/>
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

		<FormField name="lineup" label="Who's playing">
			<LineupEditor bind:value={lineup} ownerBandId={band.id} />
		</FormField>

		<!-- Straight through the form, unlike the staff modal's create-then-POST:
		     a failed upload there can leave a posterless event behind. -->
		<FormField name="posterFile" label="Poster">
			<input
				{...fields.posterFile.as('file')}
				accept="image/jpeg,image/png,image/webp"
				class="file-input w-full"
			/>
		</FormField>

		<div class="grid gap-4 md:grid-cols-2">
			<FormField
				field={fields.externalTicketUrl}
				type="text"
				label="Ticket Link (external)"
				placeholder="https://eventbrite.com/..."
			/>

			<!-- `type="text"` with a decimal inputmode, not `type="number"`: a number
			     FormField registers as `n:` and SvelteKit would hand the handler a
			     number, which `ticketPriceDollars: z.string()` rejects outright. -->
			<FormField
				field={fields.ticketPriceDollars}
				type="text"
				label="Ticket price ($)"
				placeholder="10.00"
				inputmode="decimal"
				description="What people pay, at the door or through the link. Leave blank if it's free."
			/>
		</div>

		<div class="flex justify-end pt-4">
			<SubmitButton label="Create Event" variant="primary" />
		</div>
	</Form>
</PageContent>
