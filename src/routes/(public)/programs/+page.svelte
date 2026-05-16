<script lang="ts">
	import { IconMusic, IconMicrophone, IconUsers, IconInfoCircle, IconBulb } from '@tabler/icons-svelte';
</script>

<svelte:head>
	<title>Programs | Corvallis Music Collective</title>
	<meta name="description" content="Practice space, live events, meetups, and gear lending at the Corvallis Music Collective." />
</svelte:head>

<!-- Hero -->
<section class="sunburst section-tint-secondary py-24 px-6 text-center">
	<div class="max-w-2xl mx-auto flex flex-col items-center gap-4">
		<h1 class="text-5xl font-bold leading-tight tracking-tight text-balance" style="color: var(--cmc-navy)">
			Programs
		</h1>
		<p class="text-lg leading-relaxed" style="color: var(--fg-2)">
			Practice spaces, performances, meetups & clubs for the music community
		</p>
	</div>
</section>

<!-- Practice Space -->
<section class="section-tint-success py-16 px-6">
	<div class="max-w-5xl mx-auto">
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
			<div>
				<span class="sticker-badge sticker-badge--teal" style="margin-bottom: 12px">Practice Space</span>
				<h2 class="text-3xl font-bold leading-tight mt-3 mb-4">Affordable Practice Space for Musicians</h2>
				<p class="text-base leading-relaxed mb-4" style="color: var(--fg-2)">
					Our practice rooms are equipped with professional gear and designed for musicians who need a reliable space to rehearse, record demos, and develop their craft.
				</p>
				<p class="text-base leading-relaxed mb-4" style="color: var(--fg-2)">
					Members can book hourly sessions in our sound-treated practice room, complete with a PA system, microphones, and all the essentials for a productive practice session.
				</p>
				<div class="flex items-start gap-3 rounded-lg p-4 mt-4" style="background: color-mix(in oklch, var(--cmc-teal) 12%, var(--surface)); border: 1px solid color-mix(in oklch, var(--cmc-teal) 20%, transparent)">
					<IconInfoCircle size={20} class="shrink-0 mt-0.5" style="color: var(--cmc-teal)" />
					<p class="text-sm leading-relaxed" style="color: var(--fg-2)">Practice space access requires a free CMC membership.</p>
				</div>
			</div>
			<div class="flex flex-col items-center gap-6">
				<!-- Amp + Key Fob decorative cluster -->
				<div class="flex items-end gap-5">
					<div class="amp">
						<div class="amp__grille">
							<h4 class="amp__title">Gear Library</h4>
							<p class="amp__copy">40+ instruments available. Two-week loans for members.</p>
						</div>
					</div>
					<div class="keyfob">
						<div class="keyfob__num">03</div>
						<div class="keyfob__label">Practice Room</div>
						<div class="keyfob__stripe"></div>
						<div class="keyfob__hours">10a — 10p</div>
					</div>
				</div>
			</div>
		</div>
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-10">
			<div class="rounded-lg p-6 text-center" style="background: var(--surface); border: 1px solid var(--surface-border)">
				<div class="text-sm font-bold uppercase tracking-wider mb-2" style="color: var(--fg-3)">Standard Rate</div>
				<div class="text-4xl font-bold" style="color: var(--cmc-navy)">$15/hour</div>
				<div class="text-sm mt-1" style="color: var(--fg-2)">All equipment included</div>
			</div>
			<div class="rounded-lg p-6 text-center" style="background: color-mix(in oklch, var(--cmc-orange) 12%, var(--surface)); border: 1px solid color-mix(in oklch, var(--cmc-orange) 20%, transparent)">
				<div class="text-sm font-bold uppercase tracking-wider mb-2" style="color: var(--fg-3)">Sustaining Members</div>
				<div class="text-4xl font-bold" style="color: var(--cmc-orange)">up to 10 Free Hours</div>
				<div class="text-sm mt-1" style="color: var(--fg-2)">then $15/hour</div>
			</div>
		</div>
	</div>
</section>

<!-- Shows & Performances -->
<section class="section-tint-primary py-16 px-6">
	<div class="max-w-5xl mx-auto">
		<div class="text-center mb-12">
			<span class="sticker-badge sticker-badge--orange" style="margin-bottom: 12px">Shows</span>
			<h2 class="text-4xl font-bold tracking-tight mb-3 mt-3">Shows & Performances</h2>
			<p class="text-base max-w-xl mx-auto leading-relaxed" style="color: var(--fg-2)">
				Showcase your talent and connect with the community through our regular performance opportunities.
			</p>
		</div>
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
			<div>
				<h3 class="text-2xl font-bold mb-3">Perform & Connect</h3>
				<p class="text-base leading-relaxed mb-4" style="color: var(--fg-2)">
					Whether you're a seasoned performer or just starting out, our performance programs provide supportive environments to share your music with appreciative audiences.
				</p>
				<p class="text-base leading-relaxed mb-6" style="color: var(--fg-2)">
					From intimate acoustic sets to full band productions, we create spaces where musicians can grow, collaborate, and celebrate the power of live music.
				</p>
				<div class="flex flex-wrap gap-3">
					<a href="/events" class="btn btn-primary retro-btn">View Upcoming Shows</a>
					<a href="/contact" class="btn btn-outline retro-btn" style="--btn-fill: transparent; border-color: var(--cmc-navy); color: var(--cmc-navy)">Apply to Perform</a>
				</div>
			</div>
			<!-- Ticket + Cassette decorative cluster -->
			<div class="flex flex-col items-center gap-6">
				<div class="ticket">
					<div class="ticket__main">
						<span class="ticket__eyebrow">Corvallis Music Collective</span>
						<h4 class="ticket__title">Showcase Night</h4>
						<p class="ticket__when">Fri Dec 13 &middot; 7 PM</p>
						<p class="ticket__where">6775 SW Philomath Blvd</p>
						<div class="ticket__price">
							<span>$5 NOTAFLOF</span>
							<span>Doors 6:30</span>
						</div>
					</div>
					<div class="ticket__perf"></div>
					<div class="ticket__stub"><span class="ticket__admit">Admit One</span></div>
				</div>
				<div class="cassette">
					<div class="cassette__label">
						<span class="cassette__side">Side A</span>
						<h4 class="cassette__band">your band</h4>
						<p class="cassette__title">3-track demo &middot; submit yours</p>
						<span class="cassette__stamp">Demo</span>
					</div>
					<div class="cassette__deck">
						<div class="cassette__spool"></div>
						<div class="cassette__spool"></div>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>

<!-- Meetups & Clubs -->
<section class="section-tint-warning py-16 px-6">
	<div class="max-w-5xl mx-auto">
		<div class="text-center mb-12">
			<span class="sticker-badge" style="margin-bottom: 12px">Clubs</span>
			<h2 class="text-4xl font-bold tracking-tight mb-3 mt-3">Meetups & Clubs</h2>
			<p class="text-base max-w-xl mx-auto leading-relaxed" style="color: var(--fg-2)">
				Connect with like-minded musicians through our regular meetups, learning sessions, and specialty clubs.
			</p>
		</div>
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
			<!-- Setlist decorative element -->
			<div class="flex justify-center">
				<div class="setlist">
					<div class="setlist__header">This Week<small>Recurring schedule</small></div>
					<ul class="setlist__list">
						<li class="setlist__item">
							<span>Real Book Club</span><span class="time">1st Thu</span>
						</li>
						<li class="setlist__item">
							<span>Songwriter Circle</span><span class="time">2nd Sat</span>
						</li>
						<li class="setlist__item">
							<span>Open Practice</span><span class="time">Weekly</span>
						</li>
						<li class="setlist__item">
							<span>Monthly Meetup</span><span class="time">Last Thu</span>
						</li>
					</ul>
					<div class="setlist__encore">Open Jam after every meetup!</div>
				</div>
			</div>
			<div class="flex flex-col gap-5">
				<div class="rounded-lg p-6" style="background: color-mix(in oklch, var(--cmc-yellow) 25%, var(--surface)); border: 1px solid color-mix(in oklch, var(--cmc-yellow) 30%, transparent)">
					<div class="flex items-center gap-3 mb-3">
						<IconMusic size={24} style="color: var(--cmc-navy)" />
						<h3 class="text-xl font-bold">Real Book Club</h3>
					</div>
					<p class="text-sm leading-relaxed mb-3" style="color: var(--fg-2)">
						Our flagship jazz jam club where musicians of all levels come together to explore the Great American Songbook and beyond.
					</p>
					<div class="flex items-start gap-3 rounded-lg p-3" style="background: color-mix(in oklch, var(--cmc-teal) 10%, var(--surface)); border: 1px solid color-mix(in oklch, var(--cmc-teal) 15%, transparent)">
						<IconBulb size={18} class="shrink-0 mt-0.5" style="color: var(--cmc-teal)" />
						<p class="text-xs leading-relaxed" style="color: var(--fg-2)">Bring your instrument and a Real Book (or we'll share!)</p>
					</div>
				</div>
				<div class="rounded-lg p-6" style="background: var(--surface); border: 1px solid var(--surface-border)">
					<div class="flex items-center gap-3 mb-2">
						<IconUsers size={22} style="color: var(--cmc-navy)" />
						<h3 class="text-lg font-bold">Songwriter Circle</h3>
					</div>
					<p class="text-sm leading-relaxed mb-3" style="color: var(--fg-2)">
						Monthly gathering for sharing original songs, getting feedback, and collaborating on new material.
					</p>
					<span class="sticker-badge sticker-badge--teal sticker-badge--sm">2nd Saturday &middot; 2:00 PM</span>
				</div>
				<div class="rounded-lg p-6" style="background: var(--surface); border: 1px solid var(--surface-border)">
					<div class="flex items-center gap-3 mb-2">
						<IconMicrophone size={22} style="color: var(--cmc-navy)" />
						<h3 class="text-lg font-bold">Monthly Meetup</h3>
					</div>
					<p class="text-sm leading-relaxed mb-3" style="color: var(--fg-2)">
						Come chat with — or just listen to — other local musicians about gear, gigs, and everything music-related.
					</p>
					<span class="sticker-badge sticker-badge--orange sticker-badge--sm">Last Thursday &middot; 6:30 PM</span>
				</div>
			</div>
		</div>
	</div>
</section>

<!-- Ready to Get Involved -->
<section class="section-tint-primary py-16 px-6">
	<div class="max-w-5xl mx-auto">
		<div class="text-center mb-12">
			<h2 class="text-4xl font-bold tracking-tight mb-3">Ready to Get Involved?</h2>
			<p class="text-base max-w-xl mx-auto leading-relaxed" style="color: var(--fg-2)">
				Join the Corvallis Music Collective to access all our programs and connect with a vibrant community of musicians.
			</p>
		</div>
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
			{#each [
				{ num: '1', title: 'Join CMC', desc: 'Become a member to access all programs.', badge: 'sticker-badge--teal' },
				{ num: '2', title: 'Choose Your Path', desc: 'Practice, perform, or join our clubs.', badge: 'sticker-badge--orange' },
				{ num: '3', title: 'Make Music', desc: 'Connect and create with the community.', badge: '' }
			] as step}
				<div class="text-center flex flex-col items-center gap-3">
					<span class="sticker-badge {step.badge}" style="font-size: 18px; padding: 10px 18px; transform: rotate({step.num === '2' ? '2' : step.num === '3' ? '-1' : '-2'}deg)">
						{step.num}
					</span>
					<h3 class="text-lg font-bold">{step.title}</h3>
					<p class="text-sm leading-relaxed" style="color: var(--fg-2)">{step.desc}</p>
				</div>
			{/each}
		</div>
		<div class="flex justify-center gap-4 mt-10">
			<a href="/login?redirect=/member" class="btn btn-primary btn-lg retro-btn">Become a Member</a>
			<a href="/contact" class="btn btn-outline retro-btn" style="--btn-fill: transparent; border-color: var(--cmc-navy); color: var(--cmc-navy)">Ask Questions</a>
		</div>
	</div>
</section>
