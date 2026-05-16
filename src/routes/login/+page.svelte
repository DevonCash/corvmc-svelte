<script lang="ts">
	import { enhance } from '$app/forms';
	import favicon from '$lib/assets/favicon.svg';

	let { form }: { form: any } = $props();

	let modeOverride = $state<'login' | 'register' | null>(null);
	let mode = $derived(modeOverride ?? (form?.mode === 'register' ? 'register' : 'login'));
</script>

<svelte:head>
	<title>{mode === 'login' ? 'Sign in' : 'Create account'} — CorvMC</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-base-200 px-4">
	<div class="w-full max-w-sm">
		<div class="flex flex-col items-center mb-8">
			<img src={favicon} alt="CorvMC" class="w-16 h-16 mb-3" />
			<h1 class="text-2xl font-bold">CorvMC</h1>
			<div class="tri-stripe w-24 mt-2 rounded-full"></div>
		</div>

		<div class="card bg-base-100 shadow-xl">
			<div class="card-body gap-4">
				<h2 class="card-title justify-center text-lg">
					{mode === 'login' ? 'Sign in to your account' : 'Create your account'}
				</h2>

				{#if form?.message}
					<div class="alert alert-error text-sm">
						{form.message}
					</div>
				{/if}

				<form
					method="post"
					action={mode === 'login' ? '?/login' : '?/register'}
					use:enhance
					class="flex flex-col gap-3"
				>
					{#if mode === 'register'}
						<label class="floating-label">
							<span>Name</span>
							<input
								type="text"
								name="name"
								placeholder="Name"
								value={form?.name ?? ''}
								required
								class="input input-bordered w-full"
							/>
						</label>
					{/if}

					<label class="floating-label">
						<span>Email</span>
						<input
							type="email"
							name="email"
							placeholder="Email"
							value={form?.email ?? ''}
							required
							class="input input-bordered w-full"
						/>
					</label>

					<label class="floating-label">
						<span>Password</span>
						<input
							type="password"
							name="password"
							placeholder="Password"
							required
							minlength={mode === 'register' ? 8 : undefined}
							class="input input-bordered w-full"
						/>
					</label>

					<button type="submit" class="btn btn-primary w-full mt-1">
						{mode === 'login' ? 'Sign in' : 'Create account'}
					</button>
				</form>

				<div class="divider my-0 text-xs">OR</div>

				<button
					class="btn btn-ghost btn-sm"
					onclick={() => { modeOverride = mode === 'login' ? 'register' : 'login'; }}
				>
					{mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
				</button>
			</div>
		</div>
	</div>
</div>
