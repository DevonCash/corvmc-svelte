import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';

export const load: PageServerLoad = (event) => {
	if (event.locals.user) {
		redirect(302, '/member');
	}
	return {};
};

export const actions: Actions = {
	login: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		if (!email || !password) {
			return fail(400, { email, message: 'Email and password are required.' });
		}

		try {
			await auth.api.signInEmail({
				body: { email, password }
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { email, message: 'Invalid email or password.' });
			}
			return fail(500, { email, message: 'Something went wrong. Please try again.' });
		}

		const redirectTo = event.url.searchParams.get('redirect') ?? '/member';
		redirect(302, redirectTo);
	},

	register: async (event) => {
		const formData = await event.request.formData();
		const name = formData.get('name')?.toString() ?? '';
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		if (!name || !email || !password) {
			return fail(400, { email, name, message: 'All fields are required.', mode: 'register' as const });
		}

		if (password.length < 8) {
			return fail(400, { email, name, message: 'Password must be at least 8 characters.', mode: 'register' as const });
		}

		try {
			await auth.api.signUpEmail({
				body: { email, password, name }
			});
		} catch (error) {
			if (error instanceof APIError) {
				const msg = error.message?.includes('already')
					? 'An account with that email already exists.'
					: 'Registration failed. Please try again.';
				return fail(400, { email, name, message: msg, mode: 'register' as const });
			}
			return fail(500, { email, name, message: 'Something went wrong. Please try again.', mode: 'register' as const });
		}

		const redirectTo = event.url.searchParams.get('redirect') ?? '/member';
		redirect(302, redirectTo);
	}
};
