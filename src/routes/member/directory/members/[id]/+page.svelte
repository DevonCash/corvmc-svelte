<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { getDirectoryMember, getMemberShows } from '$lib/remote/directory.remote';
	import { getMemberLayout } from '$lib/remote/layout.remote';
	import { ReportContentAction } from '$lib/components/shared/actions';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Alert from '$lib/components/shared/Alert.svelte';
	import Button from '$lib/components/shared/Button.svelte';
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
	import type { ProfileLink, DirectoryContact } from '$lib/server/db/schema/authentication';

	const BANDS_BASE = '/member/directory/bands';

	let id = $derived(page.params.id!);
	let member = $derived(await getDirectoryMember(id));
	let shows = $derived(await getMemberShows(id));
	let viewer = $derived(await getMemberLayout());

	let canReport = $derived(viewer.features.contentFlags && viewer.user.id !== id);

	let links = $derived((member?.links as ProfileLink[] | null) ?? []);
	let contact = $derived((member?.directoryContact ?? {}) as NonNullable<DirectoryContact>);

	let subtitle = $derived(member?.tagline || member?.instruments?.join(' · ') || null);

	let pills = $derived.by<ProfilePill[]>(() => {
		if (!member) return [];
		const p: ProfilePill[] = [];
		if (member.memberNumber != null)
			p.push({ label: `Member · #${String(member.memberNumber).padStart(4, '0')}` });
		if (member.lookingForBand) p.push({ label: 'Looking for a band', variant: 'warm' });
		if (member.availableForHire) p.push({ label: 'Available for hire' });
		if (member.teachesLessons) p.push({ label: 'Teaches lessons' });
		if (member.openToCollaboration) p.push({ label: 'Open to collaboration' });
		return p;
	});

	let facts = $derived(
		member
			? [
					{ label: 'Joined', value: String(new Date(member.createdAt).getFullYear()) },
					{ label: 'Pronouns', value: member.pronouns },
					{ label: 'Based in', value: member.hometown },
					{ label: 'Looking for', value: member.lookingForBand ? 'A band' : null }
				]
			: []
	);

	let bandRefs = $derived<CrossRef[]>(
		(member?.bands ?? []).map((b) => ({
			name: b.name,
			sub: b.position ?? (b.role === 'owner' || b.role === 'admin' ? 'Bandleader' : null),
			href: `${BANDS_BASE}/${b.slug}`,
			image: b.avatarUrl,
			avatarShape: 'square'
		}))
	);

	let tags = $derived([...(member?.instruments ?? []), ...(member?.genres ?? [])]);
</script>

{#if member}
	<PageContent width="3xl">
		<div class="flex items-center justify-between">
			<a href={resolve('/member/directory')} class="link text-sm opacity-60"
				>&larr; Back to Directory</a
			>
			{#if canReport}
				<ReportContentAction entityType="member_profile" entityId={id} entityLabel={member.name} />
			{/if}
		</div>

		<ProfileHeader avatarShape="round" name={member.name} {subtitle} image={member.image} {pills} />

		<QuickFacts {facts} />

		<ProfileGrid>
			{#snippet main()}
				<ProseBlock label="Bio" markdown={member.bio} />
				<ListenStrip {links} />
				<ShowsBox upcoming={shows.upcoming} pastCount={shows.pastCount} bandHref={BANDS_BASE} />
			{/snippet}
			{#snippet side()}
				<CrossRefList label="Bands" items={bandRefs} note={`${bandRefs.length} active`} />
				<TagCloud label="Plays · Genres" {tags} />
				<LinksBox {links} />
				<ContactBox label="Contact" {contact} />
			{/snippet}
		</ProfileGrid>
	</PageContent>
{:else}
	<Alert type="warning">
		Member not found or profile is hidden.
		{#snippet action()}
			<Button href="/member/directory" class="btn-sm">Back to Directory</Button>
		{/snippet}
	</Alert>
{/if}
