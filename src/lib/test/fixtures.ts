// Shared fixtures for isolated component tests and stories.
//
// These return plain objects matching the shapes that remote queries hand to
// components — they let a `.svelte.spec.ts` or `.stories.svelte` render a
// coupled component with no DB, auth, or server involved. Each factory takes an
// `overrides` partial so a test can pin only the fields it asserts on.

/** Matches the shape returned by `getMe` in `$lib/remote/layout.remote`. */
export function fakeUser(overrides: Partial<FakeUser> = {}): FakeUser {
	return {
		id: 'user-1',
		name: 'Jane Doe',
		email: 'jane@example.dev',
		image: null,
		...overrides
	};
}

export type FakeUser = {
	id: string;
	name: string;
	email: string;
	image: string | null;
};

/** Matches the band summary shape used across the member/band layouts. */
export function fakeBand(overrides: Partial<FakeBand> = {}): FakeBand {
	return {
		id: 'band-1',
		name: 'The Velvet Underground',
		slug: 'the-velvet-underground',
		avatarUrl: null,
		role: 'member',
		...overrides
	};
}

export type FakeBand = {
	id: string;
	name: string;
	slug: string;
	avatarUrl: string | null;
	role: string;
};
