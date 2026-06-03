import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, command, getRequestEvent } from '$app/server';
import { getForUser, getUnreadCount, markRead, markAllRead } from '$lib/server/notification/in-app-service';

function requireUser() {
	const { locals } = getRequestEvent();
	if (!locals.user) throw error(401, 'Not authenticated');
	return locals.user;
}

export const getNotifications = query(async () => {
	const user = requireUser();
	const [notifications, unreadCount] = await Promise.all([
		getForUser(user.id, { limit: 10 }),
		getUnreadCount(user.id)
	]);
	return { notifications, unreadCount };
});

export const markNotificationRead = command(
	z.object({ id: z.string().min(1) }),
	async ({ id }) => {
		const user = requireUser();
		await markRead(id, user.id);
	}
);

export const markAllNotificationsRead = command(async () => {
	const user = requireUser();
	await markAllRead(user.id);
});
