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
		testUtecConnection
	} from '$lib/remote/settings.remote';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import TabBar from '$lib/components/shared/TabBar.svelte';
	import { formatDollars } from '$lib/utils/format';
	import { IconPlugConnected } from '@tabler/icons-svelte';

	let activeTab = $state('pricing');
	let products = $derived(await getProducts());
	let reservationSettings = $derived(await getReservationSettings());
	let orgSettings = $derived(await getOrgSettings());
	let integrationSettings = $derived(await getIntegrationSettings());

	let connectionTestResult = $state<{ ok: boolean; error?: string } | null>(null);
	let connectionTesting = $state(false);

	const tabs = [
		{ key: 'pricing', label: 'Pricing' },
		{ key: 'reservations', label: 'Reservations' },
		{ key: 'organization', label: 'Organization' },
		{ key: 'integrations', label: 'Integrations' }
	];

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

			{#each products.filter((p) => p.key !== 'rehearsal') as product (product.key)}
				{@const isFee = product.key === 'fee_coverage'}
				{@const instance = updateProduct.for(product.key)}
				<Form
					remote={instance}
					successToast="{product.name} updated"
				>
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

							<input type="hidden" name="key" value={product.key} />

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
										<input type="hidden" name="unitAmountCents" value={product.unitAmountCents} />
									</div>
								{:else}
									<input type="hidden" name="unitAmountCents" value="0" />
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
				Configure operating hours, booking rules, and scheduling limits for practice room reservations.
			</p>

			<Form
				remote={updateReservationSettings}
				successToast="Reservation settings updated"
			>
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
									type="hidden"
									name="hourlyRateCents"
									value={String(reservationSettings.hourlyRateCents ?? 1500)}
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

			<Form
				remote={updateOrgSettings}
				successToast="Organization settings updated"
			>
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
								value={String(orgSettings.contactEmail ?? 'staff@corvmc.com')}
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
			</Form>

		{:else if activeTab === 'integrations'}
			<p class="text-sm opacity-70">
				Manage credentials for third-party integrations. Changes take effect immediately.
			</p>

			<Form
				remote={updateIntegrationSettings}
				successToast="U-tec credentials updated"
			>
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
							<div class="alert {connectionTestResult.ok ? 'alert-success' : 'alert-error'} py-2 text-sm">
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
		{/if}
	</div>
</PageContent>
