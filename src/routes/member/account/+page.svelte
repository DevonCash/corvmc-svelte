<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import Action from '$lib/components/shared/Action.svelte';
	import { SubscribeAction, UnsubscribeAction } from '$lib/components/shared/actions';
	import { IconMail, IconBell } from '@tabler/icons-svelte';
	import {
		updateProfile,
		changePassword,
		deleteAccount,
		getMySubscriptions,
		getAvailableLists,
		getMemberAccount
	} from '$lib/remote/account.remote';
	import {
		getNotificationPreferences,
		setNotificationPreference
	} from '$lib/remote/notifications.remote';

	let data = $derived(await getMemberAccount());
	let notifPrefs = $derived(await getNotificationPreferences());

	const { fields } = updateProfile;
</script>

<PageHeader title="Account Settings" />
<PageContent width="2xl">

	<!-- Profile info -->
	<InfoCard title="Contact Information">
		<Form
			remote={updateProfile}
			guard
			onsuccess={() => toast.success('Contact info updated')}
			onfailure={() => toast.error('Update failed')}
		>
			<div class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<FormField field={fields.name} type="text" label="Name" value={data.user.name} required />
					<FormField
						field={fields.pronouns}
						type="text"
						label="Pronouns"
						value={data.user.pronouns ?? ''}
						placeholder="e.g. they/them"
					/>
				</div>

				<FormField
					type="email"
					label="Email"
					value={data.user.email}
					readonly
					description="Contact staff to change your email address."
				/>

				<FormField
					field={fields.phone}
					type="tel"
					label="Phone"
					value={data.user.phone ?? ''}
					placeholder="(541) 555-0123"
				/>

				<div class="flex justify-end pt-2">
					<SubmitButton label="Save" successLabel="Saved" class="btn-primary" shortcut="mod+s" />
				</div>
			</div>
		</Form>
	</InfoCard>

	<!-- Notification preferences -->
	<InfoCard title="Notification Preferences">
		{#if notifPrefs.length === 0}
			<EmptyState message="No notification preferences available." />
		{:else}
			<table class="table">
				<thead>
					<tr>
						<th>Notification</th>
						<th class="w-20 text-center">
							<span class="tooltip" data-tip="Email"><IconMail size={16} /></span>
							<span class="sr-only">Email</span>
						</th>
						<th class="w-20 text-center">
							<span class="tooltip" data-tip="In-app"><IconBell size={16} /></span>
							<span class="sr-only">In-app</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{#each notifPrefs as pref (pref.key)}
						<tr>
							<td>
								<div>
									<p class="text-sm font-medium">{pref.label}</p>
									<p class="text-xs opacity-60">{pref.description}</p>
								</div>
							</td>
							<td class="w-20 text-center">
								<input
									type="checkbox"
									class="toggle toggle-sm toggle-primary"
									checked={pref.email}
									aria-label={`Email notifications for ${pref.label}`}
									onchange={() =>
										setNotificationPreference({
											notificationType: pref.key,
											email: !pref.email,
											inApp: pref.inApp
										})}
								/>
							</td>
							<td class="w-20 text-center">
								<input
									type="checkbox"
									class="toggle toggle-sm toggle-primary"
									checked={pref.inApp}
									aria-label={`In-app notifications for ${pref.label}`}
									onchange={() =>
										setNotificationPreference({
											notificationType: pref.key,
											email: pref.email,
											inApp: !pref.inApp
										})}
								/>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</InfoCard>

	<!-- Email Subscriptions -->
	<svelte:boundary>
		{@const subscriptions = getMySubscriptions()}
		{@const available = getAvailableLists()}
		<InfoCard title="Email Subscriptions">
			{#await Promise.all([subscriptions, available])}
				<div class="flex justify-center p-4">
					<span class="loading loading-spinner loading-sm"></span>
				</div>
			{:then [subs, avail]}
				{#if subs.length === 0 && avail.length === 0}
					<p class="text-sm opacity-60">No mailing lists available.</p>
				{:else}
					{#if subs.length > 0}
						<p class="mb-2 text-xs font-medium opacity-60">Your subscriptions</p>
						<div class="mb-4 space-y-2">
							{#each subs as sub (sub.audienceId)}
								<div class="flex items-center justify-between rounded-lg border px-4 py-2">
									<div>
										<p class="text-sm font-medium">{sub.audienceName}</p>
										{#if sub.audienceDescription}
											<p class="text-xs opacity-60">{sub.audienceDescription}</p>
										{/if}
									</div>
									<UnsubscribeAction audienceId={sub.audienceId} name={sub.audienceName} />
								</div>
							{/each}
						</div>
					{/if}

					{#if avail.length > 0}
						<p class="mb-2 text-xs font-medium opacity-60">Available lists</p>
						<div class="space-y-2">
							{#each avail as a (a.id)}
								<div class="flex items-center justify-between rounded-lg border px-4 py-2">
									<div>
										<p class="text-sm font-medium">{a.name}</p>
										{#if a.description}
											<p class="text-xs opacity-60">{a.description}</p>
										{/if}
									</div>
									<SubscribeAction audienceId={a.id} name={a.name} />
								</div>
							{/each}
						</div>
					{/if}
				{/if}
			{:catch}
				<p class="text-sm text-error">Failed to load subscriptions.</p>
			{/await}
		</InfoCard>
	</svelte:boundary>

	<!-- Security -->
	<InfoCard title="Security">
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<p class="text-sm opacity-70">Change your account password.</p>
				<Action
					action={changePassword}
					label="Change Password"
					modalTitle="Change Password"
					onsuccess={() => toast.success('Password changed')}
					onfailure={() => toast.error('Password change failed')}
					class="btn-outline btn-sm"
				>
					{#snippet form({ close })}
						<FormField
							name="currentPassword"
							type="password"
							label="Current password"
							autocomplete="current-password"
						/>
						<FormField
							name="newPassword"
							type="password"
							label="New password"
							autocomplete="new-password"
						/>
						<FormField
							name="confirmPassword"
							type="password"
							label="Confirm new password"
							autocomplete="new-password"
						/>
					{/snippet}
				</Action>
			</div>

			<div class="divider my-0"></div>

			<div class="flex items-center justify-between">
				{#if data.isStaff}
					<p class="text-sm opacity-70">Contact an admin to delete your account.</p>
					<span class="btn btn-error btn-sm btn-disabled">Delete Account</span>
				{:else}
					<p class="text-sm opacity-70">Permanently delete your account and all associated data.</p>
					<Action
						action={deleteAccount}
						label="Delete Account"
						modalTitle="Delete Account"
						submitLabel="Delete My Account"
						onfailure={() => toast.error('Deletion failed')}
						class="btn-error btn-sm"
						onsuccess={() => {
							toast.success('Account deleted');
							goto('/login');
						}}
					>
						{#snippet form({ close })}
							<div class="alert alert-error">
								<p>
									This action is permanent. Deleting your account will cancel all of your current and
									future reservations and end your subscription. This cannot be undone.
								</p>
							</div>

							<FormField
								name="password"
								type="password"
								label="Enter your password to confirm"
								autocomplete="current-password"
							/>
						{/snippet}
					</Action>
				{/if}
			</div>
		</div>
	</InfoCard>
</PageContent>
