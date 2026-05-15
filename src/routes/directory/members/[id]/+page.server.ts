import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getMemberProfile } from '$lib/server/directory/directory-service';
import type { ProfileLink, DirectoryContact } from '$lib/types/profile';

export const load: PageServerLoad = async ({ params }) => {
	const member = await getMemberProfile(params.id, 'public');
	if (!member) throw error(404, 'Member not found');

	return {
		member: {
			id: member.id,
			name: member.name,
			pronouns: member.pronouns,
			image: member.image,
			bio: member.bio,
			tagline: member.tagline,
			instruments: member.instruments,
			genres: member.genres,
			lookingForBand: member.lookingForBand,
			directoryContact: member.directoryContact as DirectoryContact | null,
			links: (member.links as ProfileLink[] | null) ?? []
		}
	};
};
