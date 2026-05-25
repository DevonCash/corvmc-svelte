<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import Form, { Field } from '$lib/components/shared/Form';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { formatDate, formatTime } from '$lib/utils/format';
	import {
		getBandEventDetail,
		updateBandEventForm,
		publishBandEvent,
		unpublishBandEvent,
		cancelBandEventForm
	} from '$lib/remote/band-events.remote';
	import { getBandLayout } from '$lib/remote/layout.remote';
	import { page } from '$app/state';

	let layout = $derived(await getBandLayout(page.params.slug!));
	let evt = $derived(
		await getBandEventDetail({ slug: page.params.slug!, eventId: page.params.eventId! })
	);
	const band = $derived(layout.band);
	const isAdmin = $derived(layout.userRole === 'owner' || layout.userRole === 'admin');

	let editing = $state(false);
</script>

<PageHeader title={evt.title} subtitle={band.name}>
	<StatusBadge status={evt.status} />
</PageHeader>
<PageContent width="lg">
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
								<a href={evt.externalTicketUrl} target="_blank" rel="noopener" class="link link-primary">
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

		<!-- Actions -->
		{#if isAdmin && evt.status !== 'cancelled'}
			<div class="flex flex-wrap gap-2">
				{#if evt.status === 'draft'}
					<Form
						action={publishBandEvent}
						onSuccess={() => {
							toast.success('Event published');
							invalidateAll();
						}}
					>
						<input type="hidden" name="slug" value={band.slug} />
						<input type="hidden" name="eventId" value={evt.id} />
						<SubmitButton class="btn-primary btn-sm">Publish</SubmitButton>
					</Form>
				{:else if evt.status === 'published'}
					<Form
						action={unpublishBandEvent}
						onSuccess={() => {
							toast.success('Event unpublished');
							invalidateAll();
						}}
					>
						<input type="hidden" name="slug" value={band.slug} />
						<input type="hidden" name="eventId" value={evt.id} />
						<SubmitButton class="btn-ghost btn-sm">Unpublish</SubmitButton>
					</Form>
				{/if}

				<Form
					action={cancelBandEventForm}
					onSuccess={() => {
						toast.success('Event cancelled');
						invalidateAll();
					}}
				>
					<input type="hidden" name="slug" value={band.slug} />
					<input type="hidden" name="eventId" value={evt.id} />
					<SubmitButton class="btn-error btn-outline btn-sm">Cancel Event</SubmitButton>
				</Form>

				<Button class="btn-ghost btn-sm" onclick={() => (editing = !editing)}>
					{editing ? 'Done Editing' : 'Edit'}
				</Button>
			</div>
		{/if}

		<!-- Edit form (toggle) -->
		{#if editing && isAdmin}
			<div class="card bg-base-200 shadow-sm">
				<div class="card-body">
					<Form
						action={updateBandEventForm}
						onSuccess={() => {
							toast.success('Event updated');
							editing = false;
							invalidateAll();
						}}
					>
						<input type="hidden" name="slug" value={band.slug} />
						<input type="hidden" name="eventId" value={evt.id} />

						<Field name="title" label="Title">
							<input type="text" name="title" class="input input-bordered w-full" value={evt.title} maxlength="200" />
						</Field>

						<Field name="description" label="Description">
							<textarea name="description" class="textarea textarea-bordered w-full" rows="4" maxlength="5000">{evt.description ?? ''}</textarea>
						</Field>

						<Field name="location" label="Location">
							<input type="text" name="location" class="input input-bordered w-full" value={evt.location ?? ''} maxlength="500" />
						</Field>

						<Field name="externalTicketUrl" label="Ticket Link">
							<input type="url" name="externalTicketUrl" class="input input-bordered w-full" value={evt.externalTicketUrl ?? ''} />
						</Field>

						<div class="flex justify-end pt-2">
							<SubmitButton>Save Changes</SubmitButton>
						</div>
					</Form>
				</div>
			</div>
		{/if}
	</div>
</PageContent>
