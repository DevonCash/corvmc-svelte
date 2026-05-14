<script lang="ts">
	import { page } from '$app/state';
	import { IconDeviceFloppy } from '@tabler/icons-svelte';
	import { getUser, getAllRoles, getUserPayments, updateUser } from './data.remote';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import CopyableId from '$lib/components/shared/CopyableId.svelte';
	import { Field } from '$lib/components/shared/Form';
	import { formatDateTime, formatCents } from '$lib/utils/format';

	let id = $derived(page.params.id!);
	let [member, allRoles, payments] = $derived(await Promise.all([getUser(id), getAllRoles(), getUserPayments(id)]));

	let roleOptions = $derived((allRoles ?? []).map((r) => ({ id: String(r.id), label: r.name })));

	let initialRoles = $derived(
		(allRoles ?? []).filter((r) => member.roles.includes(r.name)).map((r) => String(r.id))
	);
</script>

<svelte:boundary>
	<Form remote={updateUser} successToast="Changes saved">
		<PageHeader subtitle="User" title={member.name} backHref="/staff/users">
			{#if member.deletedAt}
				<span class="badge badge-error">Deleted</span>
			{/if}
			<SubmitButton shortcut="mod+s">
				{#snippet icon()}
					<IconDeviceFloppy size={20} />
				{/snippet}
			</SubmitButton>
		</PageHeader>

		<div class="grid gap-6 lg:grid-cols-2 mb-6">
			<!-- Profile card -->
			<InfoCard title="Account Info">
				<div class="@container grid grid-cols-4 gap-x-2">
					<Field
						name="name"
						type="text"
						value={member.name}
						class="col-span-4 @md:col-span-2 @lg:col-span-3"
					/>
					<Field
						name="pronouns"
						type="text"
						value={member.pronouns ?? ''}
						class="col-span-4 @md:col-span-2 @lg:col-span-1"
					/>
					<Field
						name="email"
						readonly={true}
						type="email"
						value={member.email}
						class="col-span-4 @md:col-span-2 @lg:col-span-2"
					/>
					<Field
						name="phone"
						type="tel"
						value={member.phone ?? ''}
						class="col-span-4 @md:col-span-2 @lg:col-span-2"
					/>
					<Field
						class="col-span-4 "
						name="roles"
						type="tags"
						options={roleOptions}
						multiple={true}
						value={initialRoles}
					/>
				</div>
			</InfoCard>
		</div>

		<!-- Info card -->
		<InfoCard title="Details" class='bg-base-200 shadow-none'>
			<dl class="grid gap-x-4 gap-y-2 text-sm" style="grid-template-columns: auto 1fr;">
				<dt class="opacity-60">User ID</dt>
				<dd class="font-mono text-xs">{member.id}</dd>

				<dt class="opacity-60">Stripe ID</dt>
				<dd class="font-mono text-xs">{member.stripeId ?? '—'}</dd>

				<dt class="opacity-60">Joined</dt>
				<dd>{new Date(member.createdAt).toLocaleString()}</dd>

				{#if member.deletedAt}
					<dt class="opacity-60">Deleted</dt>
					<dd>{new Date(member.deletedAt).toLocaleString()}</dd>
				{/if}
			</dl>
		</InfoCard>
	</Form>

	<!-- Payment records -->
	{#if payments.length > 0}
		<InfoCard title="Payment Records" class="mt-6">
			<div class="overflow-x-auto">
				<table class="table table-sm">
					<thead>
						<tr>
							<th>Date</th>
							<th>Amount</th>
							<th>Method</th>
							<th>Status</th>
							<th>Record</th>
						</tr>
					</thead>
					<tbody>
						{#each payments as p (p.id)}
							<tr class="hover">
								<td>{formatDateTime(p.paidAt)}</td>
								<td class="font-medium">{formatCents(p.amountCents)}</td>
								<td><span class="badge badge-outline badge-sm">{p.paymentMethod}</span></td>
								<td><StatusBadge status={p.status} /></td>
								<td>
									<div class="flex items-center gap-2">
										<CopyableId value={p.id} label="Stripe" />
										{#if p.reservationId}
											<a href="/staff/reservations/{p.reservationId}" class="btn btn-ghost btn-xs">
												View
											</a>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</InfoCard>
	{/if}

	{#snippet pending()}
		<div class="flex items-center justify-center p-12">
			<span class="loading loading-lg loading-spinner"></span>
		</div>
	{/snippet}

	{#snippet failed(error, reset)}
		{@debug error}
		<div class="alert alert-error">
			<p>Failed to load user: {String(error)}</p>
			<button class="btn btn-sm" onclick={reset}>Retry</button>
		</div>
	{/snippet}
</svelte:boundary>
