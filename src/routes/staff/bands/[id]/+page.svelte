<script lang="ts">
	import { page } from '$app/state';
	import { IconDeviceFloppy } from '@tabler/icons-svelte';
	import {
		getStaffBand as getBand,
		getStaffBandMembers as getBandMembers,
		getBandReservations,
		updateStaffBand as updateBand,
		updateMemberRole,
		getStaffPlatformInvites as getPlatformInvites,
		deactivateBand,
		reactivateBand
	} from '$lib/remote/bands.remote';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { Field } from '$lib/components/shared/Form';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import MemberLink from '$lib/components/shared/MemberLink.svelte';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import { formatDate, formatTimeRange } from '$lib/utils/format';
	import { toast } from 'svelte-sonner';
	import Action from '$lib/components/shared/Action.svelte';
	import {
		InviteByEmailAction,
		InviteMemberAction,
		RevokeInviteAction,
		TransferOwnershipAction,
		RemoveBandMemberAction,
		RevokePlatformInviteAction
	} from '$lib/components/shared/actions';

	let id = $derived(page.params.id!);
	let band = $derived(await getBand(id));
	let members = $derived(await getBandMembers(id));
	let reservations = $derived(await getBandReservations(id));
	let platformInvites = $derived(await getPlatformInvites(id));

	let isDeactivated = $derived(!!band.deletedAt);
</script>

	<Form remote={updateBand} onsuccess={() => toast.success('Band updated')}>
		<PageHeader subtitle="Band" title={band.name} backHref="/staff/bands">
			{#if isDeactivated}
				<Badge variant="error" size="md">Deactivated</Badge>
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
					<dd><MemberLink member={{ name: band.ownerName, email: band.ownerEmail, pronouns: band.ownerPronouns, role: band.ownerRole, userId: band.ownerId }} /></dd>

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
							action={reactivateBand}
							label="Reactivate"
							successToast="Band reactivated"
							class="btn-success btn-sm"
							onsuccess={() => { void getBand(id).refresh(); }}
						>
							{#snippet form({ close })}
								<input type="hidden" name="id" value={id} />
								<p class="py-4">Reactivate this band?</p>
							{/snippet}
						</Action>
					{:else}
						<Action
							action={deactivateBand}
							label="Deactivate"
							successToast="Band deactivated"
							class="btn-error btn-sm"
							onsuccess={() => { void getBand(id).refresh(); }}
						>
							{#snippet form({ close })}
								<input type="hidden" name="id" value={id} />
								<p class="py-4">Deactivate this band? All future reservations will be cancelled.</p>
							{/snippet}
						</Action>
					{/if}
				</div>
			</InfoCard>
		</div>
		</PageContent>
	</Form>

	<PageContent width="3xl">
	<InfoCard title="Members">
		{#snippet header(title)}
			<header class="flex justify-between items-center">
				<span class="card-title">{title}</span>
				<div class="flex gap-2">
					<InviteByEmailAction bandId={id} />
					<InviteMemberAction bandId={id} />
				</div>
			</header>
		{/snippet}
		<DataTable data={members} empty="No members">
			<Column key="userName" header="Member" stopClick>
				{#snippet cell(_, m)}
					<MemberLink member={{ name: m.userName, email: m.userEmail, pronouns: m.userPronouns, role: m.userRole, userId: m.userId }} />
				{/snippet}
			</Column>
			<Column key="role" header="Role" shrink stopClick>
				{#snippet cell(_, m)}
					{#if m.role !== 'owner' && m.status === 'active'}
						<Form remote={updateMemberRole} onsuccess={() => toast.success('Role updated')} onfailure={() => toast.error('Failed to update role')}>
							<input type="hidden" name="memberId" value={m.id} />
							<select
								class="select select-bordered select-xs"
								name="role"
								value={m.role}
								onchange={(e) => e.currentTarget.form?.requestSubmit()}
							>
								<option value="member">Member</option>
								<option value="admin">Admin</option>
							</select>
						</Form>
					{:else}
						<Badge variant="outline">{m.role}</Badge>
					{/if}
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
							{#if m.status === 'pending'}
								<RevokeInviteAction bandId={id} memberId={m.id} name={m.userName} />
							{/if}
							{#if m.status === 'active'}
								<TransferOwnershipAction bandId={id} newOwnerId={m.userId} name={m.userName} />
							{/if}
							<RemoveBandMemberAction bandId={id} memberId={m.id} name={m.userName} />
						</div>
					{/if}
				{/snippet}
			</Column>
		</DataTable>
	</InfoCard>

	<!-- Platform invites -->
	{#if platformInvites.filter((i) => i.status === 'pending').length > 0}
		<InfoCard title="Awaiting Signup">
			<DataTable data={platformInvites.filter((i) => i.status === 'pending')} empty="No pending email invites">
				<Column key="email" header="Email" />
				<Column key="role" header="Role" shrink>
					{#snippet cell(_, inv)}
						<Badge variant="outline">{inv.role}</Badge>
					{/snippet}
				</Column>
				<Column key="position" header="Position">
					{#snippet cell(_, inv)}
						<span class="text-sm opacity-70">{inv.position ?? '—'}</span>
					{/snippet}
				</Column>
				<Column key="invitedByName" header="Invited by" />
				<Column key="actions" header="" shrink stopClick>
					{#snippet cell(_, inv)}
						<RevokePlatformInviteAction bandId={id} inviteId={inv.id} email={inv.email} />
					{/snippet}
				</Column>
			</DataTable>
		</InfoCard>
	{/if}

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
