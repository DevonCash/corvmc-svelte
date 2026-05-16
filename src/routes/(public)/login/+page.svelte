<script lang="ts">
	import { goto } from '$app/navigation';

	let mode = $state<'login' | 'register'>('login');
	let error = $state('');
	let loading = $state(false);

	let name = $state('');
	let email = $state('');
	let password = $state('');

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		loading = true;

		try {
			const endpoint = mode === 'login'
				? '/api/auth/sign-in/email'
				: '/api/auth/sign-up/email';

			const body: Record<string, string> = { email, password };
			if (mode === 'register') body.name = name;

			const res = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (!res.ok) {
				const data = await res.json().catch(() => null);
				error = mode === 'login'
					? 'Invalid email or password.'
					: data?.message ?? 'Registration failed. Please try again.';
				return;
			}

			const redirectTo = new URLSearchParams(window.location.search).get('redirect') ?? '/member';
			await goto(redirectTo, { invalidateAll: true });
		} catch {
			error = 'Something went wrong. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>{mode === 'login' ? 'Sign in' : 'Create account'} — CorvMC</title>
</svelte:head>

<div class="flex items-center justify-center py-16 px-4">
	<div class="w-full max-w-sm">
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body gap-4">
				<h2 class="card-title justify-center text-lg">
					{mode === 'login' ? 'Sign in to your account' : 'Create your account'}
				</h2>

				{#if error}
					<div class="alert alert-error text-sm">
						{error}
					</div>
				{/if}

				<form onsubmit={handleSubmit} class="flex flex-col gap-3">
					{#if mode === 'register'}
						<label class="floating-label">
							<span>Name</span>
							<input
								type="text"
								placeholder="Name"
								bind:value={name}
								required
								class="input input-bordered w-full"
							/>
						</label>
					{/if}

					<label class="floating-label">
						<span>Email</span>
						<input
							type="email"
							placeholder="Email"
							bind:value={email}
							required
							class="input input-bordered w-full"
						/>
					</label>

					<label class="floating-label">
						<span>Password</span>
						<input
							type="password"
							placeholder="Password"
							bind:value={password}
							required
							minlength={mode === 'register' ? 8 : undefined}
							class="input input-bordered w-full"
						/>
					</label>

					<button type="submit" class="btn btn-primary w-full mt-1" disabled={loading}>
						{#if loading}
							<span class="loading loading-spinner loading-sm"></span>
						{/if}
						{mode === 'login' ? 'Sign in' : 'Create account'}
					</button>
				</form>

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
