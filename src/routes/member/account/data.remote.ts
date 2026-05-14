import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { form, getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { reservation } from '$lib/server/db/schema/reservation';
import { auth } from '$lib/server/auth';
import { eq, and, gt, ne } from 'drizzle-orm';
import { hasAnyRole } from '$lib/server/authorization';
import { cancel as cancelReservation } from '$lib/server/reservation/reservation-service';
import { cancel as cancelSubscription } from '$lib/server/finance/subscription-service';

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

export const deleteAccount = form(
	z.object({
		password: z.string().min(1, 'Password is required to delete your account')
	}),
	async (data) => {
		const currentUser = requireUser();
		const event = getRequestEvent();

		// Staff and admin accounts cannot be self-deleted
		if (await hasAnyRole(currentUser.id, ['admin', 'staff'])) {
			throw error(403, 'Staff and admin accounts cannot be deleted this way');
		}

		// Verify password by attempting sign-in
		try {
			await auth.api.signInEmail({
				headers: event.request.headers,
				body: {
					email: currentUser.email,
					password: data.password
				}
			});
		} catch {
			throw error(403, 'Incorrect password');
		}

		// Cancel all future non-cancelled reservations
		const futureReservations = await db
			.select({ id: reservation.id })
			.from(reservation)
			.where(
				and(
					eq(reservation.createdByUserId, currentUser.id),
					gt(reservation.startsAt, new Date()),
					ne(reservation.status, 'cancelled')
				)
			);

		for (const r of futureReservations) {
			await cancelReservation(r.id, currentUser.id, 'Account deleted', {
				staffOverride: true
			});
		}

		// Cancel Stripe subscription if active
		if (currentUser.stripeId) {
			try {
				await cancelSubscription(currentUser.stripeId);
			} catch {
				// Subscription may not exist — that's fine
			}
		}

		// Soft-delete the user
		await db
			.update(user)
			.set({ deletedAt: new Date().toISOString() })
			.where(eq(user.id, currentUser.id));

		// Sign out
		await auth.api.signOut({ headers: event.request.headers });

		return { success: true };
	}
);
