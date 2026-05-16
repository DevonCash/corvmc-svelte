<script lang="ts">
	import { page } from '$app/state';
	import { IconDeviceFloppy } from '@tabler/icons-svelte';
	import {
		getBand,
		getBandMembers,
		getBandReservations,
		updateBand,
		removeBandMember,
		transferBandOwnership,
		deactivateBand,
		reactivateBand
	} from './data.remote';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { Field } from '$lib/components/shared/Form';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import MemberLink from '$lib/components/shared/MemberLink.svelte';
	import { formatDate, formatTimeRange } from '$lib/utils/format';

	let id = $derived(page.params.id!);
	let band = $derived(await getBand(id));
	let members = $derived(await getBandMembers(id));
	let reservations = $derived(await getBandReservations(id));

	let isDeactivated = $derived(!!band.deletedAt);
</script>

	<Form remote={updateBand} successToast="Band updated">
		<PageHeader subtitle="Band" title={band.name} backHref="/staff/bands">
			{#if isDeactivated}
				<span class="badge badge-error">Deactivated</span>
			{/if}
			<SubmitButton shortcut="mod+s">
				{#snippet icon()}
					<IconDeviceFloppy size={20} />
				{/snippet}
			</SubmitButton>
		</PageHeader>

		<div class="grid gap-6 lg:grid-cols-2 mb-6">
			<InfoCard title="Band Info">
				<div class="grid grid-cols-1 gap-x-2">
					<Field name="name" type="text" value={band.name} />
					<Field name="bio" type="textarea" value={band.bio ?? ''} />
				</div>
			</InfoCard>

			<InfoCard title="Details" class="bg-base-200 shadow-none">
				<dl class="grid gap-x-4 gap-y-2 text-sm" style="grid-template-columns: auto 1fr;">
					<dt class="opacity-60">Band ID</dt>
					<dd class="font-mono text-xs">{band.id}</dd>

					<dt class="opacity-60">Slug</dt>
					<dd class="font-mono text-xs">{band.slug}</dd>

					<dt class="opacity-60">Owner</dt>
					<dd><MemberLink name={band.ownerName} email={band.ownerEmail} userId={band.ownerId} /></dd>

					<dt class="opacity-60">Members</dt>
					<dd>{band.memberCount} active</dd>

					<dt class="opacity-60">Created</dt>
					<dd>{new Date(band.createdAt).toLocaleDateString()}</dd>

					{#if band.deletedAt}
						<dt class="opacity-60">Deactivated</dt>
						<dd>{new Date(band.deletedAt).toLocaleDateString()}</dd>
					{/if}
				</dl>

				<div class="mt-4 flex gap-2">
					{#if isDeactivated}
						<Action
							action={() => reactivateBand({})}
							label="Reactivate"
							successToast="Band reactivated"
							class="btn-success btn-sm"
						/>
					{:else}
						<Action
							action={() => deactivateBand({})}
							label="Deactivate"
							confirm="Deactivate this band? All future reservations will be cancelled."
							successToast="Band deactivated"
							class="btn-error btn-sm"
						/>
					{/if}
				</div>
			</InfoCard>
		</div>
	</Form>

	<!-- Members -->
	<InfoCard title="Members" class="mb-6">
		<div class="overflow-x-auto">
			<table class="table table-sm">
				<thead>
					<tr>
						<th>Member</th>
						<th>Role</th>
						<th>Position</th>
						<th>Status</th>
						<th>Joined</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each members as m (m.id)}
						<tr class="hover">
							<td>
								<MemberLink name={m.userName} email={m.userEmail} userId={m.userId} />
							</td>
							<td>
								<span class="badge badge-outline badge-sm">{m.role}</span>
							</td>
							<td class="text-sm opacity-70">{m.position ?? '—'}</td>
							<td><StatusBadge status={m.status} /></td>
							<td class="text-sm">{new Date(m.createdAt).toLocaleDateString()}</td>
							<td class="text-right">
								{#if m.role !== 'owner'}
									<div class="flex gap-1 justify-end">
										{#if m.status === 'active' && m.role !== 'owner'}
											<Action
												action={() => transferBandOwnership({ newOwnerId: m.userId })}
												label="Make owner"
												confirm={`Transfer ownership to ${m.userName}? The current owner will be demoted to admin.`}
												successToast="Ownership transferred"
												class="btn-ghost btn-xs"
											/>
										{/if}
										<Action
											action={() => removeBandMember({ memberId: m.id })}
											label="Remove"
											confirm={`Remove ${m.userName} from this band?`}
											successToast="Member removed"
											class="btn-ghost btn-xs text-error"
										/>
									</div>
								{/if}
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="6" class="text-center opacity-60 py-4">No members</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</InfoCard>

	<!-- Recent Reservations -->
	<InfoCard title="Recent Reservations">
		<div class="overflow-x-auto">
			<table class="table table-sm">
				<thead>
					<tr>
						<th>Date</th>
						<th>Time</th>
						<th>Status</th>
						<th>Booked by</th>
						<th>Notes</th>
					</tr>
				</thead>
				<tbody>
					{#each reservations as r (r.id)}
						<tr
							class="hover cursor-pointer"
							onclick={() => window.location.href = `/staff/reservations/${r.id}`}
						>
							<td>{formatDate(r.startsAt.toISOString())}</td>
							<td class="text-sm">{formatTimeRange(r.startsAt.toISOString(), r.endsAt.toISOString())}</td>
							<td><StatusBadge status={r.status} /></td>
							<td class="text-sm">{r.bookedByName ?? '—'}</td>
							<td class="text-sm opacity-70 max-w-xs truncate">{r.notes ?? '—'}</td>
						</tr>
					{:else}
						<tr>
							<td colspan="5" class="text-center opacity-60 py-4">No reservations</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</InfoCard>


