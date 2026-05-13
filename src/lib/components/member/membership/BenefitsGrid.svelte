<script lang="ts">
	let { variant = 'full' }: { variant?: 'full' | 'compact' } = $props();

	const checkIcon = 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
</script>

{#snippet benefitItem(text: string)}
	<li class="flex items-start gap-2">
		<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="mt-0.5 size-5 shrink-0 text-success">
			<path stroke-linecap="round" stroke-linejoin="round" d={checkIcon} />
		</svg>
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
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6 text-primary">
							<path stroke-linecap="round" stroke-linejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
						</svg>
					</div>
					<h3 class="card-title">Practice Time</h3>
					<p class="opacity-70">For every $5 you put in each month, you get an hour of free practice time. Set up recurring reservations so your favorite slot is always waiting, and jump the line when last-minute openings pop up.</p>
				</div>
			</div>

			<div class="card bg-base-100 shadow-sm">
				<div class="card-body">
					<div class="mb-2 flex size-12 items-center justify-center rounded-full bg-secondary/10">
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6 text-secondary">
							<path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
						</svg>
					</div>
					<h3 class="card-title">Gear Library</h3>
					<p class="opacity-70">The Collective has a whole library of gear you can borrow. Sustaining members get free accessory rentals (cables, stands, the stuff you always forget), monthly equipment credits that match your contribution, and better rates on the bigger stuff.</p>
				</div>
			</div>

			<div class="card bg-base-100 shadow-sm">
				<div class="card-body">
					<div class="mb-2 flex size-12 items-center justify-center rounded-full bg-accent/10">
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6 text-accent">
							<path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
						</svg>
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
