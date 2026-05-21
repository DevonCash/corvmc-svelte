<script lang="ts">
	import { IconCheck } from '@tabler/icons-svelte';
	import Modal from '$lib/components/shared/Modal.svelte';
	import {
		CashReceivedAction,
		NoShowReservationAction
	} from '$lib/components/shared/actions';
	import { invalidateAll } from '$app/navigation';
	import MemberLink from '$lib/components/shared/MemberLink.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import { formatDate, formatTimeRange, formatDurationAndAmount } from '$lib/utils/format';

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
			memberPronouns: string | null;
		memberRole: string | null;
		}>;
		hourlyRateCents: number;
	} = $props();

	let resolved = $state<Set<string>>(new Set());

	const visible = $derived(unresolved.filter((r) => !resolved.has(r.id)));

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
				<Badge variant="warning" class="ml-1">{visible.length}</Badge>
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
								<MemberLink member={{ name: r.memberName, email: r.memberEmail, pronouns: r.memberPronouns, role: r.memberRole }} />
							</div>
							<div class="text-right">
								<p class="text-sm">{formatDate(r.startsAt)}</p>
								<p class="text-sm opacity-60">{formatTimeRange(r.startsAt, r.endsAt)}</p>
								<p class="text-sm opacity-60">{formatDurationAndAmount(r.startsAt, r.endsAt, hourlyRateCents)}</p>
							</div>
						</div>
						<div class="flex justify-end gap-2">
							<CashReceivedAction
								reservation={r}
								onsuccess={() => markResolved(r.id)}
							/>
							<NoShowReservationAction
								reservation={r}
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
