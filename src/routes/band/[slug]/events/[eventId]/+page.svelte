<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Button from '$lib/components/shared/Button.svelte';
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
					<form
						{...publishBandEvent.enhance(async (form) => {
							try {
								if (await form.submit()) {
									toast.success('Event published');
									invalidateAll();
								}
							} catch {
								toast.error('Failed to publish');
							}
						})}
						class="inline"
					>
						<input {...publishBandEvent.fields.slug.as('hidden', band.slug)} />
						<input {...publishBandEvent.fields.eventId.as('hidden', evt.id)} />
						<button class="btn btn-primary btn-sm">Publish</button>
					</form>
				{:else if evt.status === 'published'}
					<form
						{...unpublishBandEvent.enhance(async (form) => {
							try {
								if (await form.submit()) {
									toast.success('Event unpublished');
									invalidateAll();
								}
							} catch {
								toast.error('Failed to unpublish');
							}
						})}
						class="inline"
					>
						<input {...unpublishBandEvent.fields.slug.as('hidden', band.slug)} />
						<input {...unpublishBandEvent.fields.eventId.as('hidden', evt.id)} />
						<button class="btn btn-ghost btn-sm">Unpublish</button>
					</form>
				{/if}

				<form
					{...cancelBandEventForm.enhance(async (form) => {
						try {
							if (await form.submit()) {
								toast.success('Event cancelled');
								invalidateAll();
							}
						} catch {
							toast.error('Failed to cancel');
						}
					})}
					class="inline"
				>
					<input {...cancelBandEventForm.fields.slug.as('hidden', band.slug)} />
					<input {...cancelBandEventForm.fields.eventId.as('hidden', evt.id)} />
					<button class="btn btn-error btn-outline btn-sm">Cancel Event</button>
				</form>

				<Button class="btn-ghost btn-sm" onclick={() => (editing = !editing)}>
					{editing ? 'Done Editing' : 'Edit'}
				</Button>
			</div>
		{/if}

		<!-- Edit form (toggle) -->
		{#if editing && isAdmin}
			<div class="card bg-base-200 shadow-sm">
				<div class="card-body">
					<form
						{...updateBandEventForm.enhance(async (form) => {
							try {
								if (await form.submit()) {
									toast.success('Event updated');
									editing = false;
									invalidateAll();
								}
							} catch {
								toast.error('Failed to update');
							}
						})}
						class="space-y-4"
					>
						<input {...updateBandEventForm.fields.slug.as('hidden', band.slug)} />
						<input {...updateBandEventForm.fields.eventId.as('hidden', evt.id)} />

						<div class="form-control">
							<label class="label"><span class="label-text">Title</span></label>
							<input {...updateBandEventForm.fields.title.as('text', evt.title)} class="input input-bordered w-full" maxlength="200" />
						</div>

						<div class="form-control">
							<label class="label"><span class="label-text">Description</span></label>
							<textarea {...updateBandEventForm.fields.description.as('text', evt.description ?? '')} class="textarea textarea-bordered w-full" rows="4" maxlength="5000"></textarea>
						</div>

						<div class="form-control">
							<label class="label"><span class="label-text">Location</span></label>
							<input {...updateBandEventForm.fields.location.as('text', evt.location ?? '')} class="input input-bordered w-full" maxlength="500" />
						</div>

						<div class="form-control">
							<label class="label"><span class="label-text">Ticket Link</span></label>
							<input {...updateBandEventForm.fields.externalTicketUrl.as('text', evt.externalTicketUrl ?? '')} class="input input-bordered w-full" />
						</div>

						<div class="flex justify-end pt-2">
							<button class="btn btn-primary">Save Changes</button>
						</div>
					</form>
				</div>
			</div>
		{/if}
	</div>
</PageContent>
