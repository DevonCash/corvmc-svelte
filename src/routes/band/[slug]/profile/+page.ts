import { redirect } from '@sveltejs/kit';

// The band "Profile" page has been merged into "Edit Profile" (/edit).
export function load({ params }) {
	redirect(308, `/band/${params.slug}/edit`);
}
