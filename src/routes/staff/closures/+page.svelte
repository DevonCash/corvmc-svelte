<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { formatDateTime } from '$lib/utils/format';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import { Field } from '$lib/components/shared/Form';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import { createClosure, deleteClosure } from './data.remote';
	import type { StaffClosuresResponse } from '$lib/types/api';

	let { data }: { data: StaffClosuresResponse } = $props();

	const closures = $derived(data.closures);

	function isFuture(iso: string): boolean {
		return new Date(iso) > new Date();
	}
</script>

<PageHeader title="Closures" />
<PageContent>

	<InfoCard title="Add Closure">
		<Form remote={createClosure} successToast="Closure added" onsuccess={() => invalidateAll()}>
			<div class="space-y-3">
				<Field name="reason" type="text" label="Reason" />
				<div class="grid grid-cols-2 gap-4">
					<Field name="startsAt" type="datetime-local" label="Start" />
					<Field name="endsAt" type="datetime-local" label="End" />
				</div>
				<SubmitButton label="Add Closure" class="btn-primary" />
			</div>
		</Form>
	</InfoCard>

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
							<Action
								action={() => deleteClosure({ closureId: c.id })}
								label="Delete"
								confirm="Delete this closure?"
								successToast="Closure deleted"
								onsuccess={() => invalidateAll()}
								class="btn-ghost btn-sm text-error"
							/>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</PageContent>
