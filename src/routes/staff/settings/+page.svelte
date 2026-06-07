<script lang="ts">
	import {
		getProducts,
		updateProduct,
		getReservationSettings,
		updateReservationSettings,
		getOrgSettings,
		updateOrgSettings,
		getIntegrationSettings,
		updateIntegrationSettings,
		testUtecConnection,
		getFeatureFlags,
		updateFeatureFlag,
		syncSubscriptions,
		refreshCommunityStats
	} from '$lib/remote/settings.remote';
	import { getInboxChannelConfigs, updateInboxChannelConfig } from '$lib/remote/inbox.remote';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import Alert from '$lib/components/shared/Alert.svelte';
	import StatCard from '$lib/components/shared/StatCard.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import TabBar from '$lib/components/shared/TabBar.svelte';
	import type { SubscriptionSyncSummary } from '$lib/types/subscription-sync';
	import type { CommunityStats } from '$lib/server/db/schema/finance';
	import { formatDollars } from '$lib/utils/format';
	import { toast } from 'svelte-sonner';
	import {
		IconPlugConnected,
		IconMail,
		IconMessageCircle,
		IconWorld,
		IconBrandInstagram,
		IconBrandFacebook,
		IconToggleRight,
		IconToggleLeft
	} from '@tabler/icons-svelte';

	let activeTab = $state('pricing');
	let products = $derived(await getProducts());
	let reservationSettings = $derived(await getReservationSettings());
	let orgSettings = $derived(await getOrgSettings());
	let integrationSettings = $derived(await getIntegrationSettings());
	let channelConfigs = $derived(await getInboxChannelConfigs());
	let featureFlags = $derived(await getFeatureFlags());

	const { fields: reservationFields } = updateReservationSettings;

	let connectionTestResult = $state<{ ok: boolean; error?: string } | null>(null);
	let connectionTesting = $state(false);

	const tabs = [
		{ key: 'pricing', label: 'Pricing' },
		{ key: 'reservations', label: 'Reservations' },
		{ key: 'organization', label: 'Organization' },
		{ key: 'integrations', label: 'Integrations' },
		{ key: 'inbox', label: 'Inbox Channels' },
		{ key: 'features', label: 'Features' },
		{ key: 'subscriptions', label: 'Subscriptions' }
	];

	let syncResult = $state<SubscriptionSyncSummary | null>(null);
	let statsResult = $state<CommunityStats | null>(null);

	const featureMeta: Record<string, { label: string; description: string }> = {
		staffInbox: {
			label: 'Staff Inbox',
			description: 'Multi-channel unified inbox for email, SMS, and web messages'
		},
		bandPremium: {
			label: 'Band Premium',
			description: 'Premium tier with page editor, EPK, and public band sites'
		},
		bandReservations: {
			label: 'Band Reservations',
			description: 'Lets bands book the practice room from their band dashboard'
		},
		bandEvents: {
			label: 'Band Events',
			description: 'Lets bands create and manage their own events'
		},
		emailMarketing: {
			label: 'Email Marketing',
			description: 'Audience management, campaigns, and broadcast emails'
		},
		equipment: {
			label: 'Equipment',
			description: 'Equipment catalog, loan management, and equipment credits'
		},
		helpArticles: {
			label: 'Help Articles',
			description: 'Knowledge base with staff-managed articles for members'
		}
	};

	const channelMeta: Record<
		string,
		{ label: string; icon: typeof IconMail; description: string; envHint: string }
	> = {
		email: {
			label: 'Email',
			icon: IconMail,
			description: 'Receive and reply to emails via Postmark',
			envHint: 'POSTMARK_SERVER_TOKEN, POSTMARK_INBOUND_TOKEN'
		},
		sms: {
			label: 'SMS',
			icon: IconMessageCircle,
			description: 'Send and receive text messages via Twilio',
			envHint: 'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER'
		},
		web: {
			label: 'Contact Form',
			icon: IconWorld,
			description: 'Receive messages from the public contact form',
			envHint: 'Always enabled'
		},
		instagram: {
			label: 'Instagram DMs',
			icon: IconBrandInstagram,
			description: 'Receive and reply to Instagram direct messages',
			envHint: 'META_APP_SECRET, META_VERIFY_TOKEN, META_PAGE_ACCESS_TOKEN'
		},
		messenger: {
			label: 'Messenger',
			icon: IconBrandFacebook,
			description: 'Receive and reply to Facebook Messenger messages',
			envHint: 'META_APP_SECRET, META_VERIFY_TOKEN, META_PAGE_ACCESS_TOKEN'
		}
	};

	async function handleTestConnection() {
		connectionTesting = true;
		connectionTestResult = null;
		try {
			connectionTestResult = await testUtecConnection();
		} finally {
			connectionTesting = false;
		}
	}
</script>

<PageHeader title="Settings" subtitle="Staff" />

<PageContent width="2xl">
	<TabBar {tabs} active={activeTab} onchange={(key) => (activeTab = key)} />

	<div class="mt-6 space-y-4">
		{#if activeTab === 'pricing'}
			<p class="text-sm opacity-70">
				Configure the products and pricing used for checkout. Changes to names and descriptions sync
				to Stripe automatically. Price changes take effect on the next checkout.
			</p>

			{#each products as product (product.key)}
				{@const isFee = product.key === 'fee_coverage'}
				{@const instance = updateProduct.for(product.key)}
				<Form remote={instance} successToast="{product.name} updated">
					<div class="card bg-base-100 shadow">
						<div class="card-body">
							<div class="flex items-center justify-between">
								<h3 class="card-title text-base">{product.name}</h3>
								<SubmitButton
									label="Save"
									successLabel="Saved"
									errorLabel="Error"
									class="btn-sm btn-primary"
								/>
							</div>

							{#if product.stripeProductId}
								<p class="font-mono text-xs opacity-50">{product.stripeProductId}</p>
							{:else}
								<p class="text-xs opacity-50">Stripe product will be created on first checkout</p>
							{/if}

							<input {...instance.fields.key.as('hidden', product.key)} />

							<div class="mt-2 grid gap-4 sm:grid-cols-2">
								<div class="form-control">
									<label class="label" for="name-{product.key}">
										<span class="label-text">Product name</span>
									</label>
									{#each instance.fields.name.issues() ?? [] as issue (issue.message)}
										<p class="text-sm text-error">{issue.message}</p>
									{/each}
									<input
										id="name-{product.key}"
										name="name"
										type="text"
										value={product.name}
										class="input-bordered input input-sm"
									/>
								</div>

								{#if !isFee}
									<div class="form-control">
										<label class="label" for="amount-{product.key}">
											<span class="label-text">
												Amount ({product.unitLabel ?? 'per unit'})
											</span>
										</label>
										{#each instance.fields.unitAmountCents.issues() ?? [] as issue (issue.message)}
											<p class="text-sm text-error">{issue.message}</p>
										{/each}
										<label class="input-bordered input input-sm flex items-center gap-1">
											<span class="opacity-60">$</span>
											<input
												id="amount-{product.key}"
												type="number"
												step="0.01"
												min="0"
												value={formatDollars(product.unitAmountCents)}
												oninput={(e) => {
													const input = e.target as HTMLInputElement;
													const dollars = parseFloat(input.value);
													const hidden = input
														.closest('form')
														?.querySelector<HTMLInputElement>('[name="unitAmountCents"]');
													if (hidden && !isNaN(dollars))
														hidden.value = String(Math.round(dollars * 100));
												}}
												class="grow bg-transparent outline-none"
											/>
										</label>
										<input
											{...instance.fields.unitAmountCents.as(
												'hidden',
												String(product.unitAmountCents)
											)}
										/>
									</div>
								{:else}
									<input {...instance.fields.unitAmountCents.as('hidden', '0')} />
								{/if}
							</div>

							<div class="form-control mt-2">
								<label class="label" for="desc-{product.key}">
									<span class="label-text">Description</span>
								</label>
								<textarea
									id="desc-{product.key}"
									name="description"
									value={product.description ?? ''}
									class="textarea-bordered textarea textarea-sm"
									rows="2"
								></textarea>
							</div>
						</div>
					</div>
				</Form>
			{/each}
		{:else if activeTab === 'reservations'}
			<p class="text-sm opacity-70">
				Configure operating hours, booking rules, and scheduling limits for practice room
				reservations.
			</p>

			<Form remote={updateReservationSettings} guard successToast="Reservation settings updated">
				<div class="card bg-base-100 shadow">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<h3 class="card-title text-base">Pricing</h3>
							<SubmitButton
								label="Save"
								successLabel="Saved"
								errorLabel="Error"
								class="btn-sm btn-primary"
							/>
						</div>

						<div class="mt-2 grid gap-4 sm:grid-cols-2">
							<div class="form-control">
								<label class="label" for="hourlyRate">
									<span class="label-text">Hourly rate</span>
								</label>
								<label class="input-bordered input input-sm flex items-center gap-1">
									<span class="opacity-60">$</span>
									<input
										id="hourlyRate"
										type="number"
										step="0.01"
										min="0"
										value={formatDollars(Number(reservationSettings.hourlyRateCents ?? 1500))}
										oninput={(e) => {
											const input = e.target as HTMLInputElement;
											const dollars = parseFloat(input.value);
											const hidden = input
												.closest('form')
												?.querySelector<HTMLInputElement>('[name="hourlyRateCents"]');
											if (hidden && !isNaN(dollars))
												hidden.value = String(Math.round(dollars * 100));
										}}
										class="grow bg-transparent outline-none"
									/>
								</label>
								<input
									{...reservationFields.hourlyRateCents.as(
										'hidden',
										String(reservationSettings.hourlyRateCents ?? 1500)
									)}
								/>
							</div>
						</div>
					</div>
				</div>

				<div class="card bg-base-100 shadow">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<h3 class="card-title text-base">Operating Hours</h3>
						</div>

						<div class="mt-2 grid gap-4 sm:grid-cols-2">
							<FormField
								name="operatingHoursStart"
								label="Opens at"
								type="time"
								value={String(reservationSettings.operatingHoursStart ?? '09:00')}
							/>
							<FormField
								name="operatingHoursEnd"
								label="Closes at"
								type="time"
								value={String(reservationSettings.operatingHoursEnd ?? '22:00')}
							/>
						</div>
					</div>
				</div>

				<div class="card bg-base-100 shadow">
					<div class="card-body">
						<h3 class="card-title text-base">Booking Rules</h3>

						<div class="mt-2 grid gap-4 sm:grid-cols-2">
							<FormField
								name="timeSlotMinutes"
								label="Time slot granularity"
								type="select"
								value={String(reservationSettings.timeSlotMinutes ?? 30)}
								options={[
									{ value: '15', label: '15 minutes' },
									{ value: '30', label: '30 minutes' },
									{ value: '60', label: '60 minutes' }
								]}
							/>
							<FormField
								name="bufferMinutes"
								label="Buffer between reservations (min)"
								type="number"
								value={String(reservationSettings.bufferMinutes ?? 0)}
								min="0"
								step="5"
							/>
							<FormField
								name="minAdvanceMinutes"
								label="Min advance booking (minutes)"
								type="number"
								value={String(reservationSettings.minAdvanceMinutes ?? 60)}
								min="0"
								step="15"
							/>
							<FormField
								name="minDurationHours"
								label="Minimum duration (hours)"
								type="number"
								value={String(reservationSettings.minDurationHours ?? 1)}
								min="0.5"
								step="0.5"
							/>
							<FormField
								name="maxDurationHours"
								label="Maximum duration (hours)"
								type="number"
								value={String(reservationSettings.maxDurationHours ?? 8)}
								min="1"
								step="1"
							/>
							<FormField
								name="maxAdvanceDaysOneoff"
								label="Max advance booking — one-off (days)"
								type="number"
								value={String(reservationSettings.maxAdvanceDaysOneoff ?? 14)}
								min="1"
							/>
							<FormField
								name="maxAdvanceDaysRecurring"
								label="Max advance booking — recurring (days)"
								type="number"
								value={String(reservationSettings.maxAdvanceDaysRecurring ?? 17.5)}
								min="1"
								step="0.5"
							/>
						</div>
					</div>
				</div>
			</Form>
		{:else if activeTab === 'organization'}
			<p class="text-sm opacity-70">
				Organization identity used in emails, branding, and member-facing content.
			</p>

			<Form remote={updateOrgSettings} guard successToast="Organization settings updated">
				<div class="card bg-base-100 shadow">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<h3 class="card-title text-base">Organization Info</h3>
							<SubmitButton
								label="Save"
								successLabel="Saved"
								errorLabel="Error"
								class="btn-sm btn-primary"
							/>
						</div>

						<div class="mt-2 grid gap-4 sm:grid-cols-2">
							<FormField
								name="name"
								label="Organization name"
								type="text"
								value={String(orgSettings.name ?? 'Corvallis Music Collective')}
							/>
							<FormField
								name="shortName"
								label="Short name"
								type="text"
								value={String(orgSettings.shortName ?? 'CorvMC')}
								description="Used in navigation and email subjects"
							/>
							<FormField
								name="contactEmail"
								label="Staff contact email"
								type="email"
								value={String(orgSettings.contactEmail ?? 'staff@corvmc.org')}
							/>
							<FormField
								name="timezone"
								label="Timezone"
								type="select"
								value={String(orgSettings.timezone ?? 'America/Los_Angeles')}
								options={[
									{ value: 'America/Los_Angeles', label: 'Pacific (Los Angeles)' },
									{ value: 'America/Denver', label: 'Mountain (Denver)' },
									{ value: 'America/Chicago', label: 'Central (Chicago)' },
									{ value: 'America/New_York', label: 'Eastern (New York)' },
									{ value: 'America/Anchorage', label: 'Alaska (Anchorage)' },
									{ value: 'Pacific/Honolulu', label: 'Hawaii (Honolulu)' }
								]}
							/>
						</div>
					</div>
				</div>

				<div class="card bg-base-100 shadow">
					<div class="card-body">
						<h3 class="card-title text-base">Social Links</h3>
						<p class="text-xs opacity-60">Shown in the site footer. Leave blank to hide.</p>

						<div class="mt-2 grid gap-4 sm:grid-cols-2">
							<FormField
								name="socialFacebook"
								label="Facebook URL"
								type="text"
								value={String(orgSettings.socialFacebook ?? '')}
								placeholder="https://facebook.com/..."
							/>
							<FormField
								name="socialInstagram"
								label="Instagram URL"
								type="text"
								value={String(orgSettings.socialInstagram ?? '')}
								placeholder="https://instagram.com/..."
							/>
						</div>
					</div>
				</div>
			</Form>
		{:else if activeTab === 'integrations'}
			<p class="text-sm opacity-70">
				Manage credentials for third-party integrations. Changes take effect immediately.
			</p>

			<Form remote={updateIntegrationSettings} guard successToast="U-tec credentials updated">
				<div class="card bg-base-100 shadow">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<h3 class="card-title text-base">U-tec Smart Lock</h3>
							<div class="flex gap-2">
								<button
									type="button"
									class="btn btn-sm btn-ghost"
									onclick={handleTestConnection}
									disabled={connectionTesting}
								>
									{#if connectionTesting}
										<span class="loading loading-spinner loading-xs"></span>
									{:else}
										<IconPlugConnected class="size-4" />
									{/if}
									Test Connection
								</button>
								<SubmitButton
									label="Save"
									successLabel="Saved"
									errorLabel="Error"
									class="btn-sm btn-primary"
								/>
							</div>
						</div>

						{#if connectionTestResult}
							<div
								class="alert {connectionTestResult.ok
									? 'alert-success'
									: 'alert-error'} py-2 text-sm"
							>
								{#if connectionTestResult.ok}
									Connection successful — token refresh verified.
								{:else}
									Connection failed: {connectionTestResult.error}
								{/if}
							</div>
						{/if}

						<div class="mt-2 grid gap-4 sm:grid-cols-2">
							<FormField
								name="clientId"
								label="Client ID"
								type="text"
								value={integrationSettings.clientId}
							/>
							<FormField
								name="clientSecret"
								label="Client Secret"
								type="password"
								value={integrationSettings.clientSecret}
							/>
							<FormField
								name="deviceId"
								label="Device ID"
								type="text"
								value={integrationSettings.deviceId}
							/>
							<FormField
								name="refreshToken"
								label="Refresh Token"
								type="password"
								value={integrationSettings.refreshToken}
							/>
						</div>

						<p class="mt-2 text-xs opacity-50">
							Credentials can also be set via environment variables (ULTRALOC_CLIENT_ID, etc.).
							Values saved here take precedence over environment variables.
						</p>
					</div>
				</div>
			</Form>
		{:else if activeTab === 'features'}
			<p class="text-sm opacity-70">
				Enable or disable feature modules. Disabled features are hidden from navigation and return
				404 if accessed directly. Use this to control which features are available in production.
			</p>

			{#each Object.entries(featureMeta) as [flag, meta] (flag)}
				{@const enabled = featureFlags[flag as keyof typeof featureFlags]}
				{@const toggleForm = updateFeatureFlag.for(flag)}
				<div class="card bg-base-100 shadow">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-3">
								{#if enabled}
									<IconToggleRight size={20} class="text-success" />
								{:else}
									<IconToggleLeft size={20} class="opacity-40" />
								{/if}
								<div>
									<h3 class="font-semibold">{meta.label}</h3>
									<p class="text-xs opacity-60">{meta.description}</p>
								</div>
							</div>
							<form
								{...toggleForm.enhance(async ({ submit }) => {
									if (await submit()) {
										toast.success(`${meta.label} ${enabled ? 'disabled' : 'enabled'}`);
									}
								})}
							>
								<input {...toggleForm.fields.flag.as('hidden', flag)} />
								<input {...toggleForm.fields.enabled.as('hidden', enabled ? 'false' : 'true')} />
								<button
									type="submit"
									class="btn btn-sm {enabled ? 'btn-error btn-outline' : 'btn-success'}"
								>
									{enabled ? 'Disable' : 'Enable'}
								</button>
							</form>
						</div>
					</div>
				</div>
			{/each}
		{:else if activeTab === 'inbox'}
			<p class="text-sm opacity-70">
				Enable or disable communication channels for the staff inbox. Disabled channels won't
				receive or send messages. Environment variables must be configured for each channel to
				function.
			</p>

			{#each channelConfigs as cfg (cfg.channel)}
				{@const meta = channelMeta[cfg.channel]}
				{@const isWeb = cfg.channel === 'web'}
				{@const ChannelIcon = meta.icon}
				{@const toggleForm = updateInboxChannelConfig.for(cfg.channel)}
				<div class="card bg-base-100 shadow">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-3">
								<ChannelIcon size={20} class="opacity-60" />
								<div>
									<h3 class="font-semibold">{meta.label}</h3>
									<p class="text-xs opacity-60">{meta.description}</p>
								</div>
							</div>
							{#if isWeb}
								<span class="badge badge-success badge-sm">Always On</span>
							{:else}
								<form
									{...toggleForm.enhance(async ({ submit }) => {
										if (await submit()) {
											toast.success(`${meta.label} ${cfg.enabled ? 'disabled' : 'enabled'}`);
										}
									})}
								>
									<input {...toggleForm.fields.channel.as('hidden', cfg.channel)} />
									<input
										{...toggleForm.fields.enabled.as('hidden', cfg.enabled ? 'false' : 'true')}
									/>
									<button
										type="submit"
										class="btn btn-sm {cfg.enabled ? 'btn-error btn-outline' : 'btn-success'}"
									>
										{cfg.enabled ? 'Disable' : 'Enable'}
									</button>
								</form>
							{/if}
						</div>
						{#if !isWeb}
							<div class="mt-2 text-xs opacity-40">
								Env: {meta.envHint}
							</div>
						{/if}
					</div>
				</div>
			{/each}
		{:else if activeTab === 'subscriptions'}
			<p class="text-sm opacity-70">
				Reconciles every member and band subscription status from Stripe into the local database.
				Use this as a one-time backfill after migration, or any time to re-sync if a webhook was
				missed. This only updates subscription status — credit balances are never changed.
			</p>

			<Action
				label="Sync now"
				successLabel="Synced"
				successToast="Subscriptions synced from Stripe"
				action={async () => {
					syncResult = await syncSubscriptions();
				}}
			/>

			{#if syncResult}
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
					<StatCard title="Scanned" value={syncResult.totalScanned} />
					<StatCard title="Users updated" value={syncResult.usersUpdated} />
					<StatCard title="Users cleared" value={syncResult.usersCleared} />
					<StatCard title="Bands updated" value={syncResult.bandsUpdated} />
					<StatCard title="Bands cleared" value={syncResult.bandsCleared} />
					<StatCard title="Skipped" value={syncResult.skipped} />
				</div>

				{#if syncResult.errors.length > 0}
					<Alert type="warning">
						<p class="font-semibold">{syncResult.errors.length} record(s) had issues:</p>
						<ul class="mt-1 list-disc space-y-0.5 pl-5 text-sm">
							{#each syncResult.errors as err, i (i)}
								<li>
									<span class="badge badge-ghost badge-sm">{err.kind}</span>
									{err.message}{err.ref ? ` (${err.ref})` : ''}
								</li>
							{/each}
						</ul>
					</Alert>
				{/if}
			{/if}

			<div class="divider"></div>

			<p class="text-sm opacity-70">
				Community impact stats (sustaining members, free hours funded, participation) are cached for
				24 hours. Refresh to recompute them now from current subscriptions — useful right after a
				sync.
			</p>

			<Action
				label="Refresh stats"
				successLabel="Refreshed"
				successToast="Community stats refreshed"
				action={async () => {
					statsResult = await refreshCommunityStats();
				}}
			/>

			{#if statsResult}
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
					<StatCard title="Sustaining members" value={statsResult.sustainingMemberCount} />
					<StatCard title="Free hours / month" value={statsResult.totalFreeHoursAllocated} />
					<StatCard title="Participation" value={`${statsResult.participationPercent}%`} />
				</div>
			{/if}
		{/if}
	</div>
</PageContent>
