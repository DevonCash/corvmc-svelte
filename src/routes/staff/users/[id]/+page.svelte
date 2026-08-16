<script lang="ts">
	import { page } from '$app/state';
	import { IconDeviceFloppy } from '@tabler/icons-svelte';
	import {
		getUser,
		getAllRoles,
		getUserPayments,
		getUserCredits,
		updateUser,
		deactivateUser,
		reactivateUser,
		purgeUser
	} from '$lib/remote/users.remote';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { getMemberStanding, restoreListingTrust } from '$lib/remote/community-events.remote';

	const restoreFields = restoreListingTrust.fields;
	import { AdjustCreditsAction } from '$lib/components/shared/actions';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { creditsToHours } from '$lib/config';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import { clubToday } from '$lib/config';
	import { formatDateShortYear } from '$lib/utils/format';
	import {
		getMemberCertifications,
		getActiveCertifications,
		grantCertification,
		revokeCertification
	} from '$lib/remote/volunteer.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import CopyableId from '$lib/components/shared/CopyableId.svelte';
	import { Field } from '$lib/components/shared/Form';
	import Table from '$lib/components/shared/Table.svelte';
	import { formatDateTimeShort, formatCents } from '$lib/utils/format';
	import Alert from '$lib/components/shared/Alert.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import DefinitionList from '$lib/components/shared/DefinitionList/DefinitionList.svelte';
	import Fact from '$lib/components/shared/DefinitionList/Fact.svelte';

	let id = $derived(page.params.id!);
	let [member, allRoles] = $derived(await Promise.all([getUser(id), getAllRoles()]));

	let roleOptions = $derived((allRoles ?? []).map((r) => ({ id: String(r.id), label: r.name })));

	let initialRoles = $derived(
		(allRoles ?? []).filter((r) => member.roles.includes(r.name)).map((r) => String(r.id))
	);

	const { fields: updateFields } = updateUser;
	const { fields: deactivateFields } = deactivateUser;
	const { fields: reactivateFields } = reactivateUser;
	const { fields: purgeFields } = purgeUser;
</script>

<Form remote={updateUser} guard successToast="Changes saved">
	<PageHeader subtitle="User" title={member.name} backHref="/staff/users">
		{#if member.deletedAt}
			<Badge variant="error" size="md">Deactivated</Badge>
		{/if}
		<SubmitButton shortcut="mod+s">
			{#snippet icon()}
				<IconDeviceFloppy size={20} />
			{/snippet}
		</SubmitButton>
	</PageHeader>
	<PageContent width="3xl">
		<div class="mb-6">
			<!-- Profile card. Single column: this is the only card in the row, and the
			     field grid inside it already reflows on container width. -->
			<InfoCard title="Account Info">
				<!-- The mutation target travels as a validated field; `params.id` is
				     caller-controlled for remote calls and must not identify the record. -->
				<input {...updateFields.id.as('hidden', id)} />
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

		{#await getMemberStanding(id) then standing}
			{#if standing.requiresReview}
				<!-- Only rendered when it's true: a "standing: fine" card on every
				     member would be noise, and the point of this one is that it
				     appears when something happened. -->
				<InfoCard title="Community listings">
					<p class="text-sm">
						This member's listings are reviewed by staff before they go on the public calendar,
						after a report was upheld against one of them.
					</p>
					{#if standing.reason}
						<p class="mt-1 text-sm opacity-70">Staff note: "{standing.reason}"</p>
					{/if}
					<div class="mt-3">
						<Action
							action={restoreListingTrust}
							label="Restore direct publishing"
							successToast="Trust restored"
							class="btn-sm"
							onsuccess={() => invalidateAll()}
						>
							{#snippet form()}
								<input {...restoreFields.userId.as('hidden', id)} />
								<p class="py-2">Let this member publish listings straight to the calendar again?</p>
							{/snippet}
						</Action>
					</div>
				</InfoCard>
			{/if}
		{/await}

		{#await getUserCredits(id) then credits}
			<InfoCard title="Credits">
				<div class="flex gap-6 mb-3">
					<div>
						<p class="text-2xl font-medium">{creditsToHours(credits.free_hours ?? 0)}</p>
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

		<!--
			Clearances. Revoke rather than delete is the normal way to end one: the
			window it covered stays answerable, which is the entire reason the table
			is append-only. A renewal is a second Grant, not an edit.
		-->
		{#await Promise.all( [getMemberCertifications(id), getActiveCertifications()] ) then [held, catalog]}
			<InfoCard title="Certifications">
				{#snippet header(title)}
					<div class="flex items-center justify-between gap-2">
						<h3 class="card-title">{title}</h3>
						{#if catalog.length > 0}
							<Action
								action={grantCertification}
								label="Grant"
								class="btn-sm"
								modalTitle="Grant a certification"
								submitLabel="Grant"
								successToast="Certification granted"
							>
								{#snippet form()}
									<input type="hidden" name="userId" value={id} />
									<FormField
										name="certificationId"
										label="Certification"
										type="select"
										options={catalog.map((c) => ({ value: c.id, label: c.name }))}
									/>
									<FormField
										name="grantedOn"
										label="Granted on"
										type="date"
										value={clubToday()}
										max={clubToday()}
										description="Expiry is worked out from this date and locked in now — later edits to the catalog won't move it."
									/>
									<FormField
										name="reference"
										label="Card or licence number"
										type="text"
										description="For an external card. Leave blank for a CMC clearance."
									/>
									<FormField name="notes" label="Notes" type="textarea" />
								{/snippet}
							</Action>
						{/if}
					</div>
				{/snippet}

				{#if held.length === 0}
					<p class="text-sm opacity-60">Nothing on record.</p>
				{:else}
					<ul class="flex flex-col gap-3">
						{#each held as record (record.id)}
							<li class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<div class="flex flex-wrap items-center gap-2">
										<span class="font-medium">{record.certificationName}</span>
										<span
											class="badge badge-sm {record.state === 'current'
												? 'badge-success'
												: record.state === 'expiring'
													? 'badge-warning'
													: record.state === 'expired'
														? 'badge-error'
														: 'badge-neutral'}">{record.state}</span
										>
									</div>
									<div class="text-xs opacity-60">
										Granted {formatDateShortYear(record.grantedAt)}{record.grantedByName
											? ` by ${record.grantedByName}`
											: ''}{record.expiresAt
											? ` · expires ${formatDateShortYear(record.expiresAt)}`
											: ' · no expiry'}
									</div>
									{#if record.reference}
										<div class="text-xs opacity-60">#{record.reference}</div>
									{/if}
									{#if record.revokedReason}
										<div class="text-xs text-error">Revoked: {record.revokedReason}</div>
									{/if}
								</div>

								{#if !record.revokedAt}
									<Action
										action={revokeCertification.for(record.id)}
										label="Revoke"
										class="btn-ghost btn-xs text-error"
										modalTitle="Revoke {record.certificationName}?"
										submitLabel="Revoke"
										submitClass="btn-error"
										successToast="Certification revoked"
									>
										{#snippet form()}
											<input type="hidden" name="id" value={record.id} />
											<input type="hidden" name="userId" value={id} />
											<p class="text-sm">
												The record stays — the period it covered is history. They lose it from
												today, so shifts they already worked still read as cleared.
											</p>
											<FormField
												name="reason"
												label="Why"
												type="textarea"
												description="Shown to staff on this page. Most reasons are blameless — a replaced desk, an expired card, a change of duties."
											/>
										{/snippet}
									</Action>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</InfoCard>
		{/await}

		<InfoCard title="Details" class="bg-base-200 shadow-none">
			<DefinitionList>
				<Fact label="User ID" mono>{member.id}</Fact>

				<Fact label="Stripe ID" mono>{member.stripeId ?? '—'}</Fact>

				<Fact label="Joined">{new Date(member.createdAt).toLocaleString()}</Fact>

				{#if member.deletedAt}
					<Fact label="Deactivated">{new Date(member.deletedAt).toLocaleString()}</Fact>
				{/if}
			</DefinitionList>
		</InfoCard>

		<InfoCard title="Danger Zone" class="border border-error/30 bg-error/5 shadow-none mt-6">
			{#if member.deletedAt}
				<p class="text-sm opacity-70 mb-3">
					This account is deactivated. Reactivate it to restore access, or permanently delete it.
				</p>
				<div class="flex gap-2">
					<Action
						action={reactivateUser}
						label="Reactivate"
						successToast="Account reactivated"
						class="btn-success btn-sm"
						onsuccess={() => void getUser(id).refresh()}
					>
						{#snippet form()}
							<input {...reactivateFields.id.as('hidden', id)} />
							<p class="py-4">Reactivate this account?</p>
						{/snippet}
					</Action>
					<Action
						action={purgeUser}
						label="Delete permanently"
						successToast="Account deleted"
						class="btn-error btn-sm"
						onsuccess={() => goto(resolve('/staff/users'))}
					>
						{#snippet form()}
							<input {...purgeFields.id.as('hidden', id)} />
							<p class="py-4">
								Permanently delete <strong>{member.name}</strong>? This cannot be undone. The
								account must own no bands.
							</p>
						{/snippet}
					</Action>
				</div>
			{:else}
				<p class="text-sm opacity-70 mb-3">
					Deactivating signs this member out, hides them from the directory, cancels all of their
					future reservations, and cancels their membership subscription. Reactivating restores
					their access, but <strong
						>the cancelled reservations and subscription are not restored</strong
					> — they would have to be rebooked and resubscribed.
				</p>
				<Action
					action={deactivateUser}
					label="Deactivate"
					successToast="Account deactivated"
					class="btn-error btn-sm"
					onsuccess={() => void getUser(id).refresh()}
				>
					{#snippet form()}
						<input {...deactivateFields.id.as('hidden', id)} />
						<p class="py-4">
							Deactivate this account? All future reservations and their membership subscription
							will be cancelled, and reactivating will not bring them back.
						</p>
					{/snippet}
				</Action>
			{/if}
		</InfoCard>
	</PageContent>
</Form>

<PageContent width="3xl">
	{#await getUserPayments(id)}
		<div class="flex items-center justify-center p-6">
			<span class="loading loading-spinner loading-sm"></span>
		</div>
	{:then payments}
		<InfoCard title="Payment Records" class="mt-6">
			{#if payments.length === 0}
				<!-- Rendered even when empty: without it, "no payments" and "the query
				     failed" were indistinguishable — both showed nothing at all. -->
				<EmptyState
					title="No payments yet"
					description="Payments appear here once this member pays for a reservation or membership."
				/>
			{:else}
				<Table>
					{#snippet head()}
						<th class="w-px"><span class="sr-only">Status</span></th>
						<th>Paid</th>
						<th class="cell-num">Amount</th>
						<th class="col-extra">Record</th>
					{/snippet}
					{#each payments as p (p.id)}
						<tr class="hover">
							<td class="w-px"><StatusBadge status={p.status} /></td>
							<!-- Method was its own column; it qualifies the payment, so it is
							     the subline. -->
							<td class="cell-primary">
								<div class="font-medium whitespace-nowrap">
									{formatDateTimeShort(new Date(p.paidAt))}
								</div>
								<div class="text-sm opacity-60">{p.paymentMethod}</div>
							</td>
							<td class="cell-num font-medium">{formatCents(p.amountCents)}</td>
							<td class="col-extra">
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
				</Table>
			{/if}
		</InfoCard>
	{:catch}
		<Alert type="warning">Could not load payment records.</Alert>
	{/await}
</PageContent>
