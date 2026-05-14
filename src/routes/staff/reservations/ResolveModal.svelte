<script lang="ts">
	import { IconCheck } from '@tabler/icons-svelte';
	import AsyncButton from '$lib/components/AsyncButton.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { resolveComplete, resolveNoShow } from './data.remote';
	import { invalidateAll } from '$app/navigation';

	let {
		open = $bindable(false),
		unresolved,
		hourlyRateCents
	}: {
		open: boolean;
		unresolved: Array<{
			id: string;
			status: string;
			startsAt: string;
			endsAt: string;
			createdByUserId: string;
			notes: string | null;
			memberName: string;
			memberEmail: string;
		}>;
		hourlyRateCents: number;
	} = $props();

	let resolved = $state<Set<string>>(new Set());

	const visible = $derived(unresolved.filter((r) => !resolved.has(r.id)));

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			timeZone: 'America/Los_Angeles',
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	function formatTimeRange(startsAt: string, endsAt: string): string {
		const fmt = (iso: string) =>
			new Date(iso).toLocaleTimeString('en-US', {
				timeZone: 'America/Los_Angeles',
				hour: 'numeric',
				minute: '2-digit'
			});
		return `${fmt(startsAt)} – ${fmt(endsAt)}`;
	}

	function durationAndAmount(startsAt: string, endsAt: string): string {
		const ms = new Date(endsAt).getTime() - new Date(startsAt).getTime();
		const hours = ms / (1000 * 60 * 60);
		const cents = Math.round(hours * hourlyRateCents);
		const hLabel = hours === 1 ? '1 hr' : `${hours} hrs`;
		return `${hLabel} · $${(cents / 100).toFixed(2)}`;
	}

	function markResolved(id: string) {
		resolved = new Set([...resolved, id]);
		invalidateAll();
		if (visible.length <= 1) {
			setTimeout(() => {
				open = false;
				resolved = new Set();
			}, 1500);
		}
	}
</script>

<Modal bind:open>
	{#snippet titleSnippet()}
		<h3 class="text-lg font-bold">
			Resolve
			{#if visible.length > 0}
				<span class="badge badge-warning badge-sm ml-1">{visible.length}</span>
			{/if}
		</h3>
	{/snippet}

	{#if visible.length === 0}
		<div class="text-center py-8">
			<IconCheck size={48} class="mx-auto text-success mb-2" />
			<p class="text-lg font-medium">All caught up!</p>
		</div>
	{:else}
		<div class="space-y-3 max-h-96 overflow-y-auto">
			{#each visible as r (r.id)}
				<div class="card bg-base-100 border border-base-300">
					<div class="card-body p-4">
						<div class="flex justify-between mb-2">
							<div>
								<p class="font-medium">{r.memberName}</p>
								<p class="text-sm opacity-60">{r.memberEmail}</p>
							</div>
							<div class="text-right">
								<p class="text-sm">{formatDate(r.startsAt)}</p>
								<p class="text-sm opacity-60">{formatTimeRange(r.startsAt, r.endsAt)}</p>
								<p class="text-sm opacity-60">{durationAndAmount(r.startsAt, r.endsAt)}</p>
							</div>
						</div>
						<div class="flex justify-end gap-2">
							<AsyncButton
								action={async () => {
									await resolveComplete({
										reservationId: r.id,
										userId: r.createdByUserId,
										startsAt: r.startsAt,
										endsAt: r.endsAt
									});
								}}
								label="Cash received"
								successToast="Marked as paid"
								class="btn-success btn-outline btn-sm"
								onsuccess={() => markResolved(r.id)}
							/>
							<AsyncButton
								action={async () => {
									await resolveNoShow({ reservationId: r.id });
								}}
								label="No-show"
								successToast="Marked as no-show"
								class="btn-error btn-outline btn-sm"
								onsuccess={() => markResolved(r.id)}
							/>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</Modal>
