import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	listPublicMembers,
	listPublicBands
} from '$lib/server/directory/directory-service';
import { getPublicUrl, isConfigured } from '$lib/server/storage';

export const GET: RequestHandler = async ({ url }) => {
	const r2Available = isConfigured();

	const search = url.searchParams.get('search') || undefined;
	const instrumentsParam = url.searchParams.get('instruments');
	const genresParam = url.searchParams.get('genres');
	const lookingForBand = url.searchParams.get('lookingForBand') === 'true' || undefined;
	const lookingForMembers = url.searchParams.get('lookingForMembers') === 'true' || undefined;

	let instruments: string[] | undefined;
	let genres: string[] | undefined;
	try { instruments = instrumentsParam ? JSON.parse(instrumentsParam) : undefined; } catch { /* */ }
	try { genres = genresParam ? JSON.parse(genresParam) : undefined; } catch { /* */ }

	const [members, bands] = await Promise.all([
		listPublicMembers({ search, instruments, genres, lookingForBand }),
		listPublicBands({ search, genres, lookingForMembers })
	]);

	return json({
		members: members.map((m) => ({
			id: m.id,
			name: m.name,
			pronouns: m.pronouns,
			image: m.image,
			tagline: m.tagline,
			instruments: m.instruments,
			genres: m.genres,
			lookingForBand: m.lookingForBand,
			memberSince: m.createdAt,
			bands: m.bands
		})),
		bands: bands.map((b) => ({
			id: b.id,
			name: b.name,
			slug: b.slug,
			bio: b.bio ? (b.bio.length > 120 ? b.bio.slice(0, 120).trimEnd() + '…' : b.bio) : null,
			tagline: b.tagline,
			avatarUrl: b.avatarKey && r2Available ? getPublicUrl(b.avatarKey) : null,
			memberCount: b.memberCount,
			genres: b.genres,
			lookingForMembers: b.lookingForMembers
		}))
	});
};
