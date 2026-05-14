<script lang="ts">
	import { IconCircleCheck, IconMusic, IconTool, IconUsers } from '@tabler/icons-svelte';

	let { variant = 'full' }: { variant?: 'full' | 'compact' } = $props();
</script>

{#snippet benefitItem(text: string)}
	<li class="flex items-start gap-2">
		<IconCircleCheck size={20} class="mt-0.5 shrink-0 text-success" />
		<!-- @html is safe here: text is always a hardcoded string from this file, never user input -->
		<span>{@html text}</span>
	</li>
{/snippet}

{#if variant === 'full'}
	<!-- Non-member: three columns -->
	<div>
		<div class="mb-6 text-center">
			<h2 class="text-3xl font-bold">Sustaining Member Benefits</h2>
			<p class="mt-2 opacity-70">Everything you get with a monthly contribution</p>
		</div>

		<div class="grid gap-6 md:grid-cols-3">
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body">
					<div class="mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
						<IconMusic size={24} class="text-primary" />
					</div>
					<h3 class="card-title">Practice Time</h3>
					<p class="opacity-70">For every $5 you put in each month, you get an hour of free practice time. Set up recurring reservations so your favorite slot is always waiting, and jump the line when last-minute openings pop up.</p>
				</div>
			</div>

			<div class="card bg-base-100 shadow-sm">
				<div class="card-body">
					<div class="mb-2 flex size-12 items-center justify-center rounded-full bg-secondary/10">
						<IconTool size={24} class="text-secondary" />
					</div>
					<h3 class="card-title">Gear Library</h3>
					<p class="opacity-70">The Collective has a whole library of gear you can borrow. Sustaining members get free accessory rentals (cables, stands, the stuff you always forget), monthly equipment credits that match your contribution, and better rates on the bigger stuff.</p>
				</div>
			</div>

			<div class="card bg-base-100 shadow-sm">
				<div class="card-body">
					<div class="mb-2 flex size-12 items-center justify-center rounded-full bg-accent/10">
						<IconUsers size={24} class="text-accent" />
					</div>
					<h3 class="card-title">Shows & Community</h3>
					<p class="opacity-70">Half-price tickets to every Collective event and show, first dibs on workshops, and the satisfaction of knowing you're helping keep independent music going in Corvallis.</p>
				</div>
			</div>
		</div>
	</div>
{:else}
	<!-- Active member: two columns, compact -->
	<div class="grid gap-6 md:grid-cols-2">
		<div class="card bg-base-100 shadow-sm">
			<div class="card-body">
				<h3 class="card-title">Gear Library</h3>
				<ul class="mt-2 space-y-2">
					{@render benefitItem('<strong>Free accessory rentals</strong> — cables, stands, mic clips, all the essentials')}
					{@render benefitItem('<strong>Monthly equipment credits</strong> that match your contribution')}
					{@render benefitItem('<strong>Better rates</strong> on premium gear')}
				</ul>
			</div>
		</div>

		<div class="card bg-base-100 shadow-sm">
			<div class="card-body">
				<h3 class="card-title">Shows & Community</h3>
				<ul class="mt-2 space-y-2">
					{@render benefitItem('<strong>Half-price tickets</strong> to every Collective event and show')}
					{@render benefitItem('<strong>First dibs</strong> on workshops and special events')}
					{@render benefitItem("You're directly <strong>keeping music happening</strong> in Corvallis")}
				</ul>
			</div>
		</div>
	</div>
{/if}
