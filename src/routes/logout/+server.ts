import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	// Clear all possible better-auth session cookie variants
	const names = [
		'better-auth.session_token',
		'better-auth.session_data',
		'__Secure-better-auth.session_token',
		'__Secure-better-auth.session_data',
		'__Host-better-auth.session_token',
		'__Host-better-auth.session_data'
	];
	for (const name of names) {
		cookies.delete(name, { path: '/' });
	}
	throw redirect(302, '/login');
};
