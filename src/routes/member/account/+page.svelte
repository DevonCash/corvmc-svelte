<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
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
		getAvailableLists
	} from '$lib/remote/account.remote';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();


	interface NotifPref {
		key: string;
		label: string;
		description: string;
		email: boolean;
		inApp: boolean;
	}

	let notifPrefs = $state<NotifPref[]>([]);
	let prefsLoading = $state(true);

	async function loadPrefs() {
		prefsLoading = true;
		try {
			const res = await fetch('/api/notifications/preferences');
			if (res.ok) notifPrefs = await res.json();
		} finally {
			prefsLoading = false;
		}
	}

	async function togglePref(key: string, channel: 'email' | 'inApp') {
		const pref = notifPrefs.find((p) => p.key === key);
		if (!pref) return;

		const newEmail = channel === 'email' ? !pref.email : pref.email;
		const newInApp = channel === 'inApp' ? !pref.inApp : pref.inApp;

		// Optimistic update
		notifPrefs = notifPrefs.map((p) =>
			p.key === key ? { ...p, email: newEmail, inApp: newInApp } : p
		);

		await fetch('/api/notifications/preferences', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ notificationType: key, email: newEmail, inApp: newInApp })
		});
	}

	import { onMount } from 'svelte';
	onMount(loadPrefs);
</script>

<PageHeader title="Account Settings" />
<PageContent width="2xl">

	<!-- Profile info -->
	<InfoCard title="Contact Information">
		<Form
			remote={updateProfile}
			onsuccess={() => toast.success('Contact info updated')}
			onfailure={() => toast.error('Update failed')}
		>
			<div class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<FormField label="Name" id="name">
						<input
							id="name"
							name="name"
							type="text"
							value={data.user.name}
							class="input input-bordered w-full"
							required
						/>
					</FormField>

					<FormField label="Pronouns" id="pronouns">
						<input
							id="pronouns"
							name="pronouns"
							type="text"
							value={data.user.pronouns ?? ''}
							class="input input-bordered w-full"
							placeholder="e.g. they/them"
						/>
					</FormField>
				</div>

				<FormField type="email" label="Email" id="email">
					<input
						id="email"
						type="email"
						value={data.user.email}
						class="input input-bordered w-full"
						disabled
					/>
					<p class="text-xs opacity-50 mt-1">Contact staff to change your email address.</p>
				</FormField>

				<FormField label="Phone" id="phone">
					<input
						id="phone"
						name="phone"
						type="tel"
						value={data.user.phone ?? ''}
						class="input input-bordered w-full"
						placeholder="(541) 555-0123"
					/>
				</FormField>

				<div class="flex justify-end pt-2">
					<SubmitButton label="Save" successLabel="Saved" class="btn-primary" shortcut="mod+s" />
				</div>
			</div>
		</Form>
	</InfoCard>

	<!-- Notification preferences -->
	<InfoCard title="Notification Preferences">
		{#if prefsLoading}
			<div class="flex justify-center p-4">
				<span class="loading loading-spinner loading-sm"></span>
			</div>
		{:else}
			<table class="table">
				<thead>
					<tr>
						<th>Notification</th>
						<th class="text-center w-20"><span class="tooltip" data-tip="Email"><IconMail size={16} /></span></th>
						<th class="text-center w-20"><span class="tooltip" data-tip="In-app"><IconBell size={16} /></span></th>
					</tr>
				</thead>
				<tbody>
					{#each notifPrefs as pref (pref.key)}
						<tr>
							<td>
								<div>
									<p class="font-medium text-sm">{pref.label}</p>
									<p class="text-xs opacity-60">{pref.description}</p>
								</div>
							</td>
							<td class="text-center w-20">
								<input
									type="checkbox"
									class="toggle toggle-sm toggle-primary"
									checked={pref.email}
									onchange={() => togglePref(pref.key, 'email')}
								/>
							</td>
							<td class="text-center w-20">
								<input
									type="checkbox"
									class="toggle toggle-sm toggle-primary"
									checked={pref.inApp}
									onchange={() => togglePref(pref.key, 'inApp')}
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
						<p class="text-xs font-medium opacity-60 mb-2">Your subscriptions</p>
						<div class="space-y-2 mb-4">
							{#each subs as sub (sub.audienceId)}
								<div class="flex items-center justify-between border rounded-lg px-4 py-2">
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
						<p class="text-xs font-medium opacity-60 mb-2">Available lists</p>
						<div class="space-y-2">
							{#each avail as a (a.id)}
								<div class="flex items-center justify-between border rounded-lg px-4 py-2">
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
						<FormField label="Current password" id="currentPassword">
							<input
								id="currentPassword"
								name="currentPassword"
								type="password"
								class="input input-bordered w-full"
								autocomplete="current-password"
							/>
						</FormField>

						<FormField label="New password" id="newPassword">
							<input
								id="newPassword"
								name="newPassword"
								type="password"
								class="input input-bordered w-full"
								autocomplete="new-password"
							/>
						</FormField>

						<FormField label="Confirm new password" id="confirmPassword">
							<input
								id="confirmPassword"
								name="confirmPassword"
								type="password"
								class="input input-bordered w-full"
								autocomplete="new-password"
							/>
						</FormField>
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
						onsuccess={() => { toast.success('Account deleted'); goto('/login'); }}
					>
						{#snippet form({ close })}
							<div class="alert alert-error">
								<p>
									This action is permanent. Deleting your account will cancel all of your current and
									future reservations and end your subscription. This cannot be undone.
								</p>
							</div>

							<FormField
								label="Enter your password to confirm"
								id="password"
							>
								<input
									id="password"
									name="password"
									type="password"
									class="input input-bordered w-full"
									autocomplete="current-password"
								/>
							</FormField>
						{/snippet}
					</Action>
				{/if}
			</div>
		</div>
	</InfoCard>
</PageContent>
