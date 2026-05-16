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
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import MemberLink from '$lib/components/shared/MemberLink.svelte';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
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
		<PageContent width="3xl">
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
					<dd><MemberLink name={band.ownerName} email={band.ownerEmail} pronouns={band.ownerPronouns} role={band.ownerRole} userId={band.ownerId} /></dd>

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
		</PageContent>
	</Form>

	<PageContent width="3xl">
	<InfoCard title="Members">
		<DataTable data={members} empty="No members">
			<Column key="userName" header="Member" stopClick>
				{#snippet cell(_, m)}
					<MemberLink name={m.userName} email={m.userEmail} pronouns={m.userPronouns} role={m.userRole} userId={m.userId} />
				{/snippet}
			</Column>
			<Column key="role" header="Role" shrink>
				{#snippet cell(_, m)}
					<span class="badge badge-outline badge-sm">{m.role}</span>
				{/snippet}
			</Column>
			<Column key="position" header="Position">
				{#snippet cell(_, m)}
					<span class="text-sm opacity-70">{m.position ?? '—'}</span>
				{/snippet}
			</Column>
			<Column key="status" header="Status" shrink>
				{#snippet cell(_, m)}
					<StatusBadge status={m.status} />
				{/snippet}
			</Column>
			<Column key="createdAt" header="Joined" type="date" shrink />
			<Column key="actions" header="" shrink stopClick>
				{#snippet cell(_, m)}
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
				{/snippet}
			</Column>
		</DataTable>
	</InfoCard>

	<InfoCard title="Recent Reservations">
		<DataTable data={reservations} rowHref={(r) => `/staff/reservations/${r.id}`} empty="No reservations">
			<Column key="startsAt" header="Date">
				{#snippet cell(_, r)}
					{formatDate(r.startsAt.toISOString())}
				{/snippet}
			</Column>
			<Column key="time" header="Time">
				{#snippet cell(_, r)}
					<span class="text-sm">{formatTimeRange(r.startsAt.toISOString(), r.endsAt.toISOString())}</span>
				{/snippet}
			</Column>
			<Column key="status" header="Status" shrink>
				{#snippet cell(_, r)}
					<StatusBadge status={r.status} />
				{/snippet}
			</Column>
			<Column key="bookedByName" header="Booked by">
				{#snippet cell(_, r)}
					<span class="text-sm">{r.bookedByName ?? '—'}</span>
				{/snippet}
			</Column>
			<Column key="notes" header="Notes">
				{#snippet cell(_, r)}
					<span class="text-sm opacity-70 max-w-xs truncate">{r.notes ?? '—'}</span>
				{/snippet}
			</Column>
		</DataTable>
	</InfoCard>
	</PageContent>
