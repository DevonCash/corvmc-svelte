<script lang="ts">
	import type { PageServerData } from './$types';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import AsyncButton from '$lib/components/AsyncButton.svelte';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { publishEvent, cancelEvent, updateEvent } from './data.remote';

	let { data }: { data: PageServerData } = $props();

	const evt = $derived(data.event);

	let editing = $state(false);
	let editTitle = $state('');
	let editDescription = $state('');
	let editTags = $state('');

	function startEditing() {
		editTitle = evt.title;
		editDescription = evt.description ?? '';
		editTags = evt.tags ?? '';
		editing = true;
	}

	async function saveEdits() {
		try {
			await updateEvent({
				eventId: evt.id,
				title: editTitle,
				description: editDescription || null,
				tags: editTags || null
			});
			toast.success('Updated');
			editing = false;
			await invalidateAll();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to update');
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

	function fullDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			timeZone: 'America/Los_Angeles',
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatTime(iso: string): string {
		return new Date(iso).toLocaleTimeString('en-US', {
			timeZone: 'America/Los_Angeles',
			hour: 'numeric',
			minute: '2-digit'
		});
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
		<div class="card bg-base-100 shadow">
			<div class="card-body space-y-4">
				<div class="form-control">
					<label class="label" for="editTitle"><span class="label-text">Title</span></label>
					<input id="editTitle" type="text" bind:value={editTitle} class="input input-bordered" />
				</div>
				<div class="form-control">
					<label class="label" for="editDesc"><span class="label-text">Description</span></label>
					<textarea id="editDesc" bind:value={editDescription} class="textarea textarea-bordered" rows="4"></textarea>
				</div>
				<div class="form-control">
					<label class="label" for="editTags"><span class="label-text">Tags</span></label>
					<input id="editTags" type="text" bind:value={editTags} class="input input-bordered" placeholder="e.g. open mic, workshop" />
				</div>
				<div class="flex justify-end gap-2">
					<button class="btn btn-ghost btn-sm" onclick={() => (editing = false)}>Cancel</button>
					<button class="btn btn-primary btn-sm" onclick={saveEdits}>Save</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Event info card -->
	<div class="card bg-base-100 shadow">
		<div class="card-body">
			<h3 class="text-sm font-medium opacity-60 mb-3">Event Details</h3>

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
		</div>
	</div>

	<!-- Poster -->
	<div class="card bg-base-100 shadow">
		<div class="card-body">
			<h3 class="text-sm font-medium opacity-60 mb-3">Poster</h3>

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
		</div>
	</div>

	<!-- Linked reservation -->
	{#if data.linkedReservation}
		<div class="card bg-base-100 shadow">
			<div class="card-body">
				<h3 class="text-sm font-medium opacity-60 mb-3">Space Reservation</h3>
				<div class="flex items-center gap-3">
					<StatusBadge status={data.linkedReservation.status} />
					<span>{formatTime(data.linkedReservation.startsAt)} – {formatTime(data.linkedReservation.endsAt)}</span>
				</div>
				<div class="mt-2">
					<a href="/staff/reservations/{data.linkedReservation.id}" class="link link-primary text-sm">
						View reservation →
					</a>
				</div>
			</div>
		</div>
	{/if}

	<!-- Creator -->
	<div class="card bg-base-100 shadow">
		<div class="card-body">
			<h3 class="text-sm font-medium opacity-60 mb-2">Created by</h3>
			<p>{data.creator.name} ({data.creator.email})</p>
			<p class="text-sm opacity-50">Created {fullDate(evt.createdAt)}</p>
		</div>
	</div>
</div>
