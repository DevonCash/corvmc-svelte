<script lang="ts">
	import type { AudiencesResponse } from '$lib/types/api';

	let { data }: { data: AudiencesResponse } = $props();

	let email = $state('');
	let name = $state('');
	let selectedAudienceId = $state('');
	let submitting = $state(false);
	let success = $state(false);
	let errorMsg = $state('');
</script>

<div class="max-w-lg mx-auto p-6 space-y-6">
	<div class="text-center">
		<h1 class="text-2xl font-bold">Subscribe</h1>
		<p class="opacity-60 mt-1">Join our mailing lists to stay in the loop.</p>
	</div>

	{#if success}
		<div class="alert alert-success">
			<p>You've been subscribed! Check your inbox for future updates.</p>
		</div>
		<button
			class="btn btn-ghost btn-sm"
			onclick={() => {
				success = false;
				email = '';
				name = '';
				selectedAudienceId = '';
			}}
		>
			Subscribe to another list
		</button>
	{:else if data.audiences.length === 0}
		<p class="text-center opacity-60">No mailing lists are currently accepting signups.</p>
	{:else}
		<form
			method="POST"
			onsubmit={async (e) => {
				e.preventDefault();
				if (!email.trim() || !selectedAudienceId) return;
				submitting = true;
				errorMsg = '';

				try {
					const res = await fetch(`/api/marketing/audiences/${data.audiences.find((a: any) => a.id === selectedAudienceId)?.slug}`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined })
					});

					if (!res.ok) {
						const body = await res.json().catch(() => null);
						throw new Error(body?.message ?? 'Something went wrong');
					}

					success = true;
				} catch (err) {
					errorMsg = err instanceof Error ? err.message : 'Something went wrong';
				} finally {
					submitting = false;
				}
			}}
			class="space-y-4"
		>
			<div>
				<label for="sub-list" class="label text-sm font-medium">Choose a list</label>
				<div class="space-y-2">
					{#each data.audiences as a (a.id)}
						<label class="label cursor-pointer gap-3 border rounded-lg px-4 py-3 {selectedAudienceId === a.id ? 'border-primary bg-primary/10' : 'border-base-300'}">
							<input
								type="radio"
								name="audience"
								class="radio radio-primary radio-sm"
								value={a.id}
								bind:group={selectedAudienceId}
							/>
							<div class="flex-1">
								<p class="font-medium text-sm">{a.name}</p>
								{#if a.description}
									<p class="text-xs opacity-60">{a.description}</p>
								{/if}
							</div>
						</label>
					{/each}
				</div>
			</div>

			<div>
				<label for="sub-email" class="label text-sm font-medium">Email</label>
				<input
					id="sub-email"
					type="email"
					bind:value={email}
					placeholder="your@email.com"
					class="input-bordered input w-full"
					required
				/>
			</div>

			<div>
				<label for="sub-name" class="label text-sm font-medium">Name (optional)</label>
				<input
					id="sub-name"
					type="text"
					bind:value={name}
					placeholder="Your name"
					class="input-bordered input w-full"
				/>
			</div>

			{#if errorMsg}
				<div class="alert alert-error text-sm">{errorMsg}</div>
			{/if}

			<button
				type="submit"
				class="btn btn-primary w-full"
				disabled={!email.trim() || !selectedAudienceId || submitting}
			>
				{#if submitting}
					<span class="loading loading-sm loading-spinner"></span>
				{/if}
				Subscribe
			</button>
		</form>
	{/if}
</div>
