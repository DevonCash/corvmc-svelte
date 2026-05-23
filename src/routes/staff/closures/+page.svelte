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
	import { UpdateClosureAction, DeleteClosureAction } from '$lib/components/shared/actions';
	import Button from '$lib/components/shared/Button.svelte';
	import { getClosures, createClosure } from '$lib/remote/closures.remote';

	let closures = $derived(await getClosures());

	let editId = $state<string | null>(null);
	let editReason = $state('');
	let editStartsAt = $state('');
	let editEndsAt = $state('');

	function isFuture(iso: string): boolean {
		return new Date(iso) > new Date();
	}

	function toLocalDatetime(iso: string): string {
		const d = new Date(iso);
		const offset = d.getTimezoneOffset();
		const local = new Date(d.getTime() - offset * 60000);
		return local.toISOString().slice(0, 16);
	}

	function startEdit(c: { id: string; reason: string; startsAt: string; endsAt: string }) {
		editId = c.id;
		editReason = c.reason;
		editStartsAt = toLocalDatetime(c.startsAt);
		editEndsAt = toLocalDatetime(c.endsAt);
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
					<div class="card-body py-4">
						{#if editId === c.id}
							<div class="space-y-3">
								<input type="text" bind:value={editReason} class="input input-bordered w-full input-sm" />
								<div class="grid grid-cols-2 gap-4">
									<input type="datetime-local" bind:value={editStartsAt} class="input input-bordered input-sm" />
									<input type="datetime-local" bind:value={editEndsAt} class="input input-bordered input-sm" />
								</div>
								<div class="flex justify-end gap-2">
									<Button class="btn-ghost btn-sm" onclick={() => (editId = null)}>Cancel</Button>
									<UpdateClosureAction closureId={c.id} reason={editReason} startsAt={editStartsAt} endsAt={editEndsAt} onsuccess={() => { editId = null; invalidateAll(); }} />
								</div>
							</div>
						{:else}
							<div class="flex items-center justify-between">
								<div>
									<p class="font-medium">{c.reason}</p>
									<p class="text-sm opacity-60">
										{formatDateTime(c.startsAt)} — {formatDateTime(c.endsAt)}
									</p>
								</div>
								{#if isFuture(c.startsAt)}
									<div class="flex gap-1">
										<Button class="btn-ghost btn-sm" onclick={() => startEdit(c)}>Edit</Button>
										<DeleteClosureAction closureId={c.id} />
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</PageContent>
