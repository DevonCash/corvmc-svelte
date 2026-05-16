<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDateTime } from '$lib/utils/format';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';

	let { data }: { data: any } = $props();

	const closures = $derived(data.closures);

	function isFuture(iso: string): boolean {
		return new Date(iso) > new Date();
	}
</script>

<div class="space-y-6">
	<h1 class="text-2xl font-bold">Closures</h1>

	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<h2 class="card-title text-lg">Add Closure</h2>
			<form method="POST" action="?/create" use:enhance class="space-y-3">
				<div class="form-control">
					<label class="label" for="reason">
						<span class="label-text">Reason</span>
					</label>
					<input id="reason" name="reason" type="text" class="input input-bordered" required placeholder="Maintenance, event, holiday..." />
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div class="form-control">
						<label class="label" for="startsAt">
							<span class="label-text">Start</span>
						</label>
						<input id="startsAt" name="startsAt" type="datetime-local" class="input input-bordered" required />
					</div>
					<div class="form-control">
						<label class="label" for="endsAt">
							<span class="label-text">End</span>
						</label>
						<input id="endsAt" name="endsAt" type="datetime-local" class="input input-bordered" required />
					</div>
				</div>
				<button type="submit" class="btn btn-primary">Add Closure</button>
			</form>
		</div>
	</div>

	{#if closures.length === 0}
		<EmptyState message="No closures." />
	{:else}
		<div class="space-y-3">
			{#each closures as c}
				<div class="card bg-base-100 shadow-sm">
					<div class="card-body flex-row items-center justify-between py-4">
						<div>
							<p class="font-medium">{c.reason}</p>
							<p class="text-sm opacity-60">
								{formatDateTime(c.startsAt)} — {formatDateTime(c.endsAt)}
							</p>
						</div>
						{#if isFuture(c.startsAt)}
							<form method="POST" action="?/delete" use:enhance>
								<input type="hidden" name="closureId" value={c.id} />
								<button type="submit" class="btn btn-ghost btn-sm text-error">Delete</button>
							</form>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
