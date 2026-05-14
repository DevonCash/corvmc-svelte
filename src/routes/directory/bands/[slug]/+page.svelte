<script lang="ts">
	import type { PageServerData } from './$types';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';

	let { data }: { data: PageServerData } = $props();

	const band = $derived(data.band);
	const members = $derived(data.members);
</script>

<div class="max-w-2xl mx-auto space-y-6 p-6">
	<a href="/directory" class="link text-sm opacity-60">&larr; Back to Directory</a>

	<!-- Band header -->
	<div class="flex items-center gap-4">
		<div class="avatar placeholder">
			<div class="bg-neutral text-neutral-content w-16 rounded-full">
				{#if band.avatarUrl}
					<img src={band.avatarUrl} alt={band.name} class="rounded-full" />
				{:else}
					<span class="text-2xl">{band.name.charAt(0).toUpperCase()}</span>
				{/if}
			</div>
		</div>
		<div>
			<h1 class="text-2xl font-bold">{band.name}</h1>
			<p class="text-sm opacity-60">
				{band.memberCount} member{band.memberCount === 1 ? '' : 's'}
			</p>
		</div>
	</div>

	{#if band.bio}
		<p class="text-base-content/80">{band.bio}</p>
	{/if}

	<!-- Members -->
	<section>
		<h2 class="text-lg font-semibold mb-3">Members</h2>
		<div class="space-y-2">
			{#each members as member (member.id)}
				<div class="card bg-base-100 shadow-sm">
					<div class="card-body py-3 flex-row items-center justify-between">
						<div class="flex items-center gap-3">
							<div class="avatar placeholder">
								<div class="bg-neutral text-neutral-content w-8 rounded-full">
									{#if member.userImage}
										<img src={member.userImage} alt={member.userName} class="rounded-full" />
									{:else}
										<span class="text-xs">{member.userName.charAt(0).toUpperCase()}</span>
									{/if}
								</div>
							</div>
							<div>
								<p class="font-medium">{member.userName}</p>
								{#if member.position}
									<p class="text-xs opacity-60">{member.position}</p>
								{/if}
							</div>
						</div>
						<StatusBadge status={member.role} />
					</div>
				</div>
			{/each}
		</div>
	</section>
</div>
