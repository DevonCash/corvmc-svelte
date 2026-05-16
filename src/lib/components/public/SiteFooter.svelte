<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
</script>

<footer class="mt-16" style="background: var(--bg-section); border-top: 1px solid var(--surface-border)">
	<div class="tri-stripe"></div>
	<div class="max-w-5xl mx-auto px-4 py-12">
		<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
			<div>
				<a href="/" class="flex items-center gap-2 text-lg font-bold mb-3">
					<img src={favicon} alt="" class="w-6 h-6" />
					CorvMC
				</a>
				<p class="text-sm" style="color: var(--fg-2)">
					Building and connecting music communities in Corvallis.
				</p>
			</div>

			<div>
				<h3 class="eyebrow mb-3">Links</h3>
				<ul class="space-y-1 text-sm">
					<li><a href="/about" class="link link-hover">About</a></li>
					<li><a href="/programs" class="link link-hover">Programs</a></li>
					<li><a href="/events" class="link link-hover">Events</a></li>
					<li><a href="/contribute" class="link link-hover">Contribute</a></li>
					<li><a href="/contact" class="link link-hover">Contact</a></li>
				</ul>
			</div>

			<div>
				<h3 class="eyebrow mb-3">Contact</h3>
				<ul class="space-y-1 text-sm" style="color: var(--fg-2)">
					<li>6775 A Philomath Blvd</li>
					<li>Corvallis, OR 97333</li>
					<li><a href="mailto:info@corvmc.org" class="link link-hover">info@corvmc.org</a></li>
				</ul>
			</div>
		</div>

		<div class="divider"></div>

		<div class="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs" style="color: var(--fg-3)">
			<p>&copy; {new Date().getFullYear()} Corvallis Music Collective</p>
			<p>501(c)(3) Nonprofit Organization &middot; EIN: 99-1052908</p>
		</div>
	</div>
</footer>
