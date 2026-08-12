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

	// Gates the price/capacity block. FormField's `toggle` submits this as a real
	// boolean, so the schema default handles the unchecked case.
	let ticketingEnabled = $state(false);

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
			description="Selling somewhere else? Link it here instead of turning on ticketing below."
		/>

		<FormField
			name="ticketingEnabled"
			type="toggle"
			label="Ticketing"
			checkboxLabel="Sell tickets through CMC"
			bind:value={ticketingEnabled}
		/>

		{#if ticketingEnabled}
			<div class="card bg-base-200 p-4">
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<FormField
						field={fields.ticketPriceDollars}
						type="number"
						label="Ticket price ($)"
						min="0.01"
						step="0.01"
						placeholder="15.00"
					/>
					<FormField
						field={fields.ticketQuantity}
						type="number"
						label="Capacity"
						min="1"
						step="1"
						placeholder="Unlimited"
					/>
				</div>
				<p class="text-sm opacity-60 mt-2">
					Leave capacity blank for unlimited tickets. Sales are collected by CMC — talk to staff
					about getting paid out.
				</p>
			</div>
		{/if}

		<div class="flex justify-end pt-4">
			<SubmitButton label="Create Event" class="btn-primary" />
		</div>
	</Form>
</PageContent>
