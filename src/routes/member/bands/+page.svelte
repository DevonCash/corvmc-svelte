<script lang="ts">
	import type { PageServerData } from './$types';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import Modal from '$lib/components/shared/Modal.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { createBand, acceptInvite, declineInvite } from './data.remote';

	let { data }: { data: PageServerData } = $props();

	const pending = $derived(data.pending);
	const active = $derived(data.active);

	let showCreateModal = $state(false);
	const createInitial = { name: '', bio: '' };
</script>

<div class="max-w-2xl space-y-6">
	<PageHeader title="My Bands" subtitle="Member">
		<button class="btn btn-primary btn-sm" onclick={() => (showCreateModal = true)}>
			Create Band
		</button>
	</PageHeader>

	<!-- Pending invitations -->
	{#if pending.length > 0}
		<section>
			<h2 class="text-lg font-semibold mb-3">Pending Invitations</h2>
			<div class="space-y-3">
				{#each pending as invite (invite.id)}
					{@const accept = acceptInvite.for(invite.id)}
					{@const decline = declineInvite.for(invite.id)}
					<div class="card bg-base-100 shadow">
						<div class="card-body py-4">
							<div class="flex items-center justify-between">
								<div>
									<p class="font-medium">{invite.name}</p>
									<p class="text-sm opacity-60">
										Invited as {invite.role}
									</p>
								</div>
								<div class="flex gap-2">
									<Form
										remote={accept}
										initial={{ memberId: invite.id }}
										successToast="Invitation accepted"
										errorToast="Failed to accept"
										onsuccess={() => invalidateAll()}
									>
										<input type="hidden" name="memberId" value={invite.id} />
										<SubmitButton label="Accept" successLabel="Accepted" class="btn-primary btn-sm" />
									</Form>
									<Form
										remote={decline}
										initial={{ memberId: invite.id }}
										successToast="Invitation declined"
										errorToast="Failed to decline"
										onsuccess={() => invalidateAll()}
									>
										<input type="hidden" name="memberId" value={invite.id} />
										<SubmitButton label="Decline" successLabel="Declined" class="btn-ghost btn-sm" />
									</Form>
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Active bands -->
	<section>
		{#if active.length === 0 && pending.length === 0}
			<EmptyState message="You're not in any bands yet. Create one to get started." />
		{:else if active.length === 0}
			<EmptyState message="No active bands yet." />
		{:else}
			<div class="space-y-3">
				{#each active as b (b.id)}
					<a href="/band/{b.slug}" class="card bg-base-100 shadow hover:shadow-md transition-shadow">
						<div class="card-body py-4 flex-row items-center justify-between">
							<div>
								<p class="font-medium">{b.name}</p>
								<p class="text-sm opacity-60">
									{b.memberCount} {b.memberCount === 1 ? 'member' : 'members'}
								</p>
							</div>
							<StatusBadge status={b.role} />
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</section>
</div>

<!-- Create Band Modal -->
<Modal title="Create Band" bind:open={showCreateModal}>
	<Form
		remote={createBand}
		initial={createInitial}
		successToast="Band created"
		errorToast="Failed to create band"
		onsuccess={(result) => {
			showCreateModal = false;
			if (result?.slug) goto(`/band/${result.slug}`);
		}}
	>
		<div class="space-y-4">
			<FormField label="Band name" id="band-name" issues={createBand.fields.name.issues()}>
				<input
					id="band-name"
					name="name"
					type="text"
					class="input input-bordered w-full"
					placeholder="e.g. The Velvet Underground"
					required
				/>
			</FormField>

			<FormField label="Bio" id="band-bio" issues={createBand.fields.bio.issues()}>
				<textarea
					id="band-bio"
					name="bio"
					class="textarea textarea-bordered w-full"
					rows="3"
					placeholder="Tell people about your band (optional)"
				></textarea>
			</FormField>

			<div class="flex justify-end pt-2">
				<SubmitButton label="Create Band" successLabel="Created" class="btn-primary" />
			</div>
		</div>
	</Form>
</Modal>
