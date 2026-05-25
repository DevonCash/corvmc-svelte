<script lang="ts">
	import { page } from '$app/state';
	import { IconDeviceFloppy } from '@tabler/icons-svelte';
	import { getUser, getAllRoles, getUserPayments, getUserCredits, updateUser } from '$lib/remote/users.remote';
	import { invalidateAll } from '$app/navigation';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { AdjustCreditsAction } from '$lib/components/shared/actions';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import CopyableId from '$lib/components/shared/CopyableId.svelte';
	import { Field } from '$lib/components/shared/Form';
	import { formatDateTime, formatCents } from '$lib/utils/format';
	import Alert from '$lib/components/shared/Alert.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import Button from '$lib/components/shared/Button.svelte';

	let id = $derived(page.params.id!);
	let [member, allRoles] = $derived(await Promise.all([getUser(id), getAllRoles()]));

	let roleOptions = $derived((allRoles ?? []).map((r) => ({ id: String(r.id), label: r.name })));

	let initialRoles = $derived(
		(allRoles ?? []).filter((r) => member.roles.includes(r.name)).map((r) => String(r.id))
	);
</script>

	<Form remote={updateUser} successToast="Changes saved">
		<PageHeader subtitle="User" title={member.name} backHref="/staff/users">
			{#if member.deletedAt}
				<Badge variant="error" size="md">Deleted</Badge>
			{/if}
			<SubmitButton shortcut="mod+s">
				{#snippet icon()}
					<IconDeviceFloppy size={20} />
				{/snippet}
			</SubmitButton>
		</PageHeader>
		<PageContent width="3xl">
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

		{#await getUserCredits(id) then credits}
			<InfoCard title="Credits">
				<div class="flex gap-6 mb-3">
					<div>
						<p class="text-2xl font-medium">{credits.free_hours ?? 0}</p>
						<p class="text-sm opacity-60">Free Hours</p>
					</div>
					<div>
						<p class="text-2xl font-medium">{credits.equipment_credits ?? 0}</p>
						<p class="text-sm opacity-60">Equipment Credits</p>
					</div>
				</div>
				<AdjustCreditsAction userId={id} />
			</InfoCard>
		{/await}

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
		</PageContent>
	</Form>

	<PageContent width="3xl">
	{#await getUserPayments(id)}
		<div class="flex items-center justify-center p-6">
			<span class="loading loading-spinner loading-sm"></span>
		</div>
	{:then payments}
		{#if payments.length > 0}
			<InfoCard title="Payment Records" class="mt-6">
				<div class="overflow-x-auto">
					<table class="table">
						<thead>
							<tr>
								<th>Date</th>
								<th class="w-px">Amount</th>
								<th class="w-px">Method</th>
								<th class="w-px">Status</th>
								<th class="w-px">Record</th>
							</tr>
						</thead>
						<tbody>
							{#each payments as p (p.id)}
								<tr class="hover">
									<td>{formatDateTime(p.paidAt)}</td>
									<td class="w-px"><span class="font-medium">{formatCents(p.amountCents)}</span></td>
									<td class="w-px"><Badge variant="outline">{p.paymentMethod}</Badge></td>
									<td class="w-px"><StatusBadge status={p.status} /></td>
									<td class="w-px">
										<div class="flex items-center gap-2">
											<CopyableId value={p.id} label="Stripe" />
											{#if p.reservationId}
												<Button href="/staff/reservations/{p.reservationId}" class="btn-ghost btn-xs">
													View
												</Button>
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
	{:catch}
		<Alert type="warning">Could not load payment records.</Alert>
	{/await}
	</PageContent>
