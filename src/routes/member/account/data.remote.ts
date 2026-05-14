import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { form, getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { auth } from '$lib/server/auth';
import { eq } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireUser() {
	const { locals } = getRequestEvent();
	if (!locals.user) throw error(401, 'Not authenticated');
	return locals.user;
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

export const updateProfile = form(
	z.object({
		name: z.string().min(1, 'Name is required').max(255),
		pronouns: z.string().max(50).optional().default(''),
		phone: z.string().max(30).optional().default('')
	}),
	async (data) => {
		const currentUser = requireUser();

		await db
			.update(user)
			.set({
				name: data.name,
				pronouns: data.pronouns || null,
				phone: data.phone || null,
				updatedAt: new Date()
			})
			.where(eq(user.id, currentUser.id));

		return { success: true };
	}
);

export const changePassword = form(
	z
		.object({
			currentPassword: z.string().min(1, 'Current password is required'),
			newPassword: z.string().min(8, 'Password must be at least 8 characters'),
			confirmPassword: z.string().min(1, 'Please confirm your password')
		})
		.refine((d) => d.newPassword === d.confirmPassword, {
			message: 'Passwords do not match',
			path: ['confirmPassword']
		}),
	async (data) => {
		const currentUser = requireUser();
		const event = getRequestEvent();

		// Use better-auth's change-password endpoint via internal API
		const res = await auth.api.changePassword({
			headers: event.request.headers,
			body: {
				currentPassword: data.currentPassword,
				newPassword: data.newPassword,
				revokeOtherSessions: false
			}
		});

		return { success: true };
	}
);
