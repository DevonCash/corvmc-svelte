<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { getDirectoryBand, getBandShows } from '$lib/remote/directory.remote';
	import { getMemberLayout } from '$lib/remote/layout.remote';
	import { ReportContentAction } from '$lib/components/shared/actions';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import ProfileHeader, {
		type ProfilePill
	} from '$lib/components/shared/directory/profile/ProfileHeader.svelte';
	import QuickFacts from '$lib/components/shared/directory/profile/QuickFacts.svelte';
	import ProseBlock from '$lib/components/shared/directory/profile/ProseBlock.svelte';
	import ListenStrip from '$lib/components/shared/directory/profile/ListenStrip.svelte';
	import ShowsBox from '$lib/components/shared/directory/profile/ShowsBox.svelte';
	import CrossRefList, {
		type CrossRef
	} from '$lib/components/shared/directory/profile/CrossRefList.svelte';
	import TagCloud from '$lib/components/shared/directory/profile/TagCloud.svelte';
	import LinksBox from '$lib/components/shared/directory/profile/LinksBox.svelte';
	import ContactBox from '$lib/components/shared/directory/profile/ContactBox.svelte';
	import ProfileGrid from '$lib/components/shared/directory/profile/ProfileGrid.svelte';

	const MEMBERS_BASE = '/member/directory/members';

	let data = $derived(await getDirectoryBand(page.params.slug!));
	let shows = $derived(await getBandShows(data.band.id));
	let viewer = $derived(await getMemberLayout());

	const band = $derived(data.band);

	let canReport = $derived(
		viewer.features.contentFlags && !data.members.some((m) => m.userId === viewer.user.id)
	);
	const contact = $derived(band.directoryContact ?? {});

	let subtitle = $derived(band.tagline || band.genres.join(' · ') || null);

	let pills = $derived.by<ProfilePill[]>(() => {
		const p: ProfilePill[] = [
			{ label: `${band.memberCount} member${band.memberCount === 1 ? '' : 's'}` }
		];
		if (band.lookingForMembers) p.push({ label: 'Looking for members', variant: 'warm' });
		return p;
	});

	let facts = $derived([
		{ label: 'Formed', value: band.foundedYear },
		{ label: 'Genre', value: band.genres.join(' · ') },
		{ label: 'Based in', value: band.hometown },
		{ label: 'Looking for', value: band.lookingForMembers ? 'Members' : null }
	]);

	let memberRefs = $derived<CrossRef[]>(
		data.members.map((m) => ({
			name: m.userName ?? 'Member',
			sub: m.position ?? (m.role === 'owner' || m.role === 'admin' ? 'Bandleader' : null),
			href: `${MEMBERS_BASE}/${m.userId}`,
			image: m.userImage,
			avatarShape: 'round',
			private: m.private
		}))
	);
</script>

<PageContent width="3xl">
	<div class="flex items-center justify-between">
		<a href={resolve('/member/directory')} class="link text-sm opacity-60"
			>&larr; Back to Directory</a
		>
		{#if canReport}
			<ReportContentAction entityType="band_profile" entityId={band.id} entityLabel={band.name} />
		{/if}
	</div>

	<ProfileHeader avatarShape="square" name={band.name} {subtitle} image={band.avatarUrl} {pills} />

	<QuickFacts {facts} />

	<ProfileGrid>
		{#snippet main()}
			<ProseBlock label="About" markdown={band.bio} />
			<ListenStrip links={band.links} />
			<ShowsBox upcoming={shows.upcoming} pastCount={shows.pastCount} />
		{/snippet}
		{#snippet side()}
			<CrossRefList label="Members" items={memberRefs} note={`${band.memberCount} · roles`} />
			<TagCloud label="Genres · Influences" tags={band.genres} />
			<LinksBox links={band.links} />
			<ContactBox label="Booking" {contact} />
		{/snippet}
	</ProfileGrid>
</PageContent>
