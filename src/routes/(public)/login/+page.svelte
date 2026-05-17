<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Form, { Field, SubmitButton } from '$lib/components/shared/Form';

	let inviteToken = $derived(page.url.searchParams.get('invite'));
	let inviteMeta = $state<{ bandName: string; inviterName: string; role: string; email: string } | null>(null);

	let mode = $state<'login' | 'register'>(page.url.searchParams.has('invite') ? 'register' : 'login');
	let error = $state('');

	$effect(() => {
		if (inviteToken) {
			mode = 'register';
			fetch(`/api/invites/${inviteToken}`)
				.then((r) => (r.ok ? r.json() : null))
				.then((data) => { inviteMeta = data as typeof inviteMeta; });
		}
	});

	async function handleSubmit(data: FormData) {
		error = '';
		const endpoint = mode === 'login'
			? '/api/auth/sign-in/email'
			: '/api/auth/sign-up/email';

		const body: Record<string, string> = {
			email: data.get('email') as string,
			password: data.get('password') as string
		};
		if (mode === 'register') body.name = data.get('name') as string;

		const res = await fetch(endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

		if (!res.ok) {
			const body = await res.json().catch(() => null) as { message?: string } | null;
			error = mode === 'login'
				? 'Invalid email or password.'
				: body?.message ?? 'Registration failed. Please try again.';
			throw new Error(error);
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
		<div class="card shadow-xl" style="background: var(--surface); border: 1px solid var(--surface-border)">
			<div class="card-body gap-4">
				{#if inviteMeta}
					<div class="alert alert-info text-sm">
						<span><strong>{inviteMeta.inviterName}</strong> invited you to join <strong>{inviteMeta.bandName}</strong>. Create an account to get started.</span>
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

				<Form action={handleSubmit} errorToast="" class="flex flex-col gap-3">
					{#if mode === 'register'}
						<Field name="name" type="text" label="Name" />
					{/if}
					<Field name="email" type="email" label="Email" value={inviteMeta?.email ?? ''} />
					<Field name="password" type="password" label="Password"
						minlength={mode === 'register' ? 8 : undefined} />
					<SubmitButton
						label={mode === 'login' ? 'Sign in' : 'Create account'}
						class="btn-primary w-full mt-1"
					/>
				</Form>

				<div class="divider my-0 text-xs">OR</div>

				<button
					class="btn btn-ghost btn-sm"
					onclick={() => { mode = mode === 'login' ? 'register' : 'login'; error = ''; }}
				>
					{mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
				</button>
			</div>
		</div>
	</div>
</div>
