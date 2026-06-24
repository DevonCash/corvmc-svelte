<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { IconEye, IconEyeOff } from '@tabler/icons-svelte';
	import { Turnstile } from 'svelte-turnstile';
	import Form, { Field, SubmitButton } from '$lib/components/shared/Form';
	import { getMe } from '$lib/remote/layout.remote';
	import { TURNSTILE_SITE_KEY } from '$lib/turnstile';

	let me = $derived(await getMe());
	$effect(() => {
		if (me) goto(resolve('/member'));
	});

	let inviteToken = $derived(page.url.searchParams.get('invite'));
	let inviteMeta = $state<{
		bandName: string;
		inviterName: string;
		role: string;
		email: string;
	} | null>(null);

	let mode = $state<'login' | 'register'>(
		page.url.searchParams.has('invite') || page.url.searchParams.has('register')
			? 'register'
			: 'login'
	);
	let error = $state('');
	let showPassword = $state(false);
	let turnstileToken = $state('');
	let resetTurnstile = $state<() => void>();

	$effect(() => {
		if (inviteToken) {
			mode = 'register';
			fetch(`/api/invites/${inviteToken}`)
				.then((r) => (r.ok ? r.json() : null))
				.then((data) => {
					inviteMeta = data as typeof inviteMeta;
				});
		}
	});

	async function handleSubmit(data: FormData) {
		error = '';
		const endpoint = mode === 'login' ? '/api/auth/sign-in/email' : '/api/auth/sign-up/email';

		const body: Record<string, string> = {
			email: data.get('email') as string,
			password: data.get('password') as string
		};
		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		if (mode === 'register') {
			body.name = data.get('name') as string;
			headers['x-turnstile-token'] = turnstileToken;
		}

		const res = await fetch(endpoint, {
			method: 'POST',
			headers,
			body: JSON.stringify(body)
		});

		if (!res.ok) {
			if (mode === 'register') resetTurnstile?.();
			const body = (await res.json().catch(() => null)) as { message?: string } | null;
			error =
				mode === 'login'
					? 'Invalid email or password.'
					: (body?.message ?? 'Registration failed. Please try again.');
			// Throw so the Form shows its error state, but carry the HTTP status so
			// `reportError`'s `isExpected` check drops these 4xx auth failures instead
			// of logging every bad password to Sentry. A 5xx still reports as a bug.
			throw Object.assign(new Error(error), { status: res.status });
		}

		const redirectTo = new URLSearchParams(window.location.search).get('redirect') ?? '/member';
		await goto(redirectTo, { invalidateAll: true });
	}
</script>

<svelte:head>
	<title>{mode === 'login' ? 'Sign in' : 'Create account'} — CorvMC</title>
</svelte:head>

<div class="flex items-center justify-center py-16 px-4">
	<div class="w-full max-w-sm">
		<div
			class="card shadow-xl"
			style="background: var(--surface); border: 1px solid var(--surface-border)"
		>
			<div class="card-body gap-4">
				{#if inviteMeta}
					<div class="alert alert-info text-sm">
						<span
							><strong>{inviteMeta.inviterName}</strong> invited you to join
							<strong>{inviteMeta.bandName}</strong>. Create an account to get started.</span
						>
					</div>
				{/if}

				<h2 class="card-title justify-center text-lg">
					{mode === 'login' ? 'Sign in to your account' : 'Create your account'}
				</h2>

				{#if error}
					<div class="alert alert-error text-sm">
						{error}
					</div>
				{/if}

				<Form action={handleSubmit} class="flex flex-col gap-3">
					{#if mode === 'register'}
						<Field name="name" type="text" label="Name" />
					{/if}
					<Field name="email" type="email" label="Email" value={inviteMeta?.email ?? ''} />
					<Field
						name="password"
						type={showPassword ? 'text' : 'password'}
						label="Password"
						minlength={mode === 'register' ? 8 : undefined}
					>
						{#snippet input(id)}
							<div class="relative">
								<input
									{id}
									name="password"
									type={showPassword ? 'text' : 'password'}
									class="input-bordered input w-full pr-10"
									minlength={mode === 'register' ? 8 : undefined}
								/>
								<button
									type="button"
									class="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-square"
									onclick={() => (showPassword = !showPassword)}
									tabindex={-1}
								>
									{#if showPassword}
										<IconEyeOff size={16} />
									{:else}
										<IconEye size={16} />
									{/if}
								</button>
							</div>
						{/snippet}
					</Field>
					{#if mode === 'register'}
						<Turnstile
							siteKey={TURNSTILE_SITE_KEY}
							theme="auto"
							bind:reset={resetTurnstile}
							on:callback={(e) => (turnstileToken = e.detail.token)}
							on:expired={() => (turnstileToken = '')}
						/>
					{/if}
					<SubmitButton
						label={mode === 'login' ? 'Sign in' : 'Create account'}
						class="btn-primary w-full mt-1"
					/>
				</Form>

				<div class="divider my-0 text-xs">OR</div>

				<button
					class="btn btn-ghost btn-sm"
					onclick={() => {
						mode = mode === 'login' ? 'register' : 'login';
						error = '';
					}}
				>
					{mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
				</button>
			</div>
		</div>
	</div>
</div>
