import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, form, getRequestEvent } from '$app/server';
import { requireStaff, requireUser } from '$lib/server/authorization';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/authentication';
import { role, modelHasRole } from '$lib/server/db/schema/authorization';
import { reservation } from '$lib/server/db/schema/reservation';
import { band, bandMember } from '$lib/server/db/schema/band';
import { eq, or, like, isNull, count, desc, gte, lte, ne, inArray, sql, and } from 'drizzle-orm';
import { getUserRoles } from '$lib/server/authorization';
import { permission } from '$lib/server/db/schema/authorization';
import { paginate } from '$lib/server/db/paginate';
import { listByUser, list as listPayments } from '$lib/server/finance/payment-cache-service';
import { getAllBalances, addCredits, deductCredits, listTransactions } from '$lib/server/finance/credit-service';
import { getSubscription } from '$lib/server/finance/subscription-service';
import { listUpcoming } from '$lib/server/event/event-service';
import { resolveImageUrl } from '$lib/server/storage';
import { startOfWeek, endOfWeek } from 'date-fns';
import { getPartsInTz, buildDateInTz } from '$lib/server/reservation/timezone';
import type { CreditType } from '$lib/server/db/schema/finance';
import { DEFAULT_TIMEZONE } from '$lib/config';

// ---------------------------------------------------------------------------
// Staff list queries
// ---------------------------------------------------------------------------

export const getStaffDashboard = query(async () => {
	await requireStaff();
	const startOfMonth = new Date();
	startOfMonth.setDate(1);
	startOfMonth.setHours(0, 0, 0, 0);

	const [totalUsersResult, totalRolesResult, totalPermissionsResult, newUsersResult, recentUsers] =
		await Promise.all([
			db.select({ value: count() }).from(user),
			db.select({ value: count() }).from(role),
			db.select({ value: count() }).from(permission),
			db.select({ value: count() }).from(user).where(gte(user.createdAt, startOfMonth)),
			db.select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt })
				.from(user).orderBy(desc(user.createdAt)).limit(5)
		]);

	return {
		stats: {
			totalUsers: totalUsersResult[0].value,
			totalRoles: totalRolesResult[0].value,
			totalPermissions: totalPermissionsResult[0].value,
			newUsersThisMonth: newUsersResult[0].value
		},
		recentUsers
	};
});

const staffUsersFilters = z.object({
	search: z.string().optional(),
	page: z.number().optional()
});

export const getStaffUsers = query(staffUsersFilters, async (filters) => {
	await requireStaff();

	const search = filters.search?.trim();
	const searchCondition = search
		? or(like(user.name, `%${search}%`), like(user.email, `%${search}%`))
		: undefined;
	const activeCondition = isNull(user.deletedAt);
	const where = searchCondition ? and(searchCondition, activeCondition) : activeCondition;

	const dataQ = db
		.select({ id: user.id, name: user.name, email: user.email, pronouns: user.pronouns, createdAt: user.createdAt })
		.from(user)
		.where(where)
		.orderBy(desc(user.createdAt))
		.$dynamic();

	const countQ = db.select({ count: count() }).from(user).where(where);

	const { rows: users, pagination } = await paginate(dataQ, countQ, { page: filters.page ?? 1, pageSize: 20 });

	const userIds = users.map((u) => u.id);
	let roleMap: Record<string, string[]> = {};

	if (userIds.length > 0) {
		const roleRows = await db
			.select({ userId: modelHasRole.userId, roleName: role.name })
			.from(modelHasRole)
			.innerJoin(role, eq(role.id, modelHasRole.roleId))
			.where(or(...userIds.map((id) => eq(modelHasRole.userId, id)))!);

		for (const row of roleRows) {
			if (!roleMap[row.userId]) roleMap[row.userId] = [];
			roleMap[row.userId].push(row.roleName);
		}
	}

	return {
		rows: users.map((u) => ({ ...u, roles: roleMap[u.id] ?? [] })),
		pagination
	};
});

const staffPaymentsFilters = z.object({
	search: z.string().optional(),
	method: z.string().optional(),
	status: z.string().optional(),
	from: z.string().optional(),
	to: z.string().optional(),
	page: z.number().optional()
});

export const getStaffPayments = query(staffPaymentsFilters, async (filters) => {
	await requireStaff();
	return listPayments(
		{
			search: filters.search || undefined,
			method: filters.method || undefined,
			status: filters.status || undefined,
			from: filters.from || undefined,
			to: filters.to || undefined
		},
		{ page: filters.page ?? 1, pageSize: 50 }
	);
});

const staffCreditsFilters = z.object({
	search: z.string().optional(),
	creditType: z.string().optional(),
	source: z.string().optional(),
	from: z.string().optional(),
	to: z.string().optional(),
	page: z.number().optional()
});

export const getStaffCredits = query(staffCreditsFilters, async (filters) => {
	await requireStaff();
	return listTransactions(
		{
			search: filters.search || undefined,
			creditType: (filters.creditType || undefined) as CreditType | undefined,
			source: (filters.source || undefined) as import('$lib/server/finance/credit-service').CreditTransactionFilters['source'],
			from: filters.from || undefined,
			to: filters.to || undefined
		},
		{ page: filters.page ?? 1, pageSize: 50 }
	);
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getUser = query(z.string(), async (id) => {
	const [found] = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			pronouns: user.pronouns,
			phone: user.phone,
			stripeId: user.stripeId,
			createdAt: user.createdAt,
			deletedAt: user.deletedAt
		})
		.from(user)
		.where(eq(user.id, id))
		.limit(1);

	if (!found) error(404, 'User not found');

	const roles = await getUserRoles(id);

	return { ...found, roles };
});

export const getAllRoles = query(async () => {
	return db.select({ id: role.id, name: role.name }).from(role);
});

export const getUserPayments = query(z.string(), async (userId) => {
	return listByUser(userId);
});

export const getUserCredits = query(z.string(), async (userId) => {
	return getAllBalances(userId);
});

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

const updateUserSchema = z.object({
	name: z.string().trim().min(1).max(255),
	pronouns: z.string().trim().max(50),
	phone: z.string().trim().max(30),
	roles: z
		.string()
		.transform((s) => JSON.parse(s) as string[])
		.pipe(z.array(z.string().regex(/^\d+$/, 'Invalid role ID')))
		.default([])
});

export const updateUser = form(updateUserSchema, async (rawData) => {
	const data = rawData as z.infer<typeof updateUserSchema>;
	const { params } = getRequestEvent();
	const id = params.id!;
	const roleIds = data.roles.map(Number);

	await db.transaction(async (tx) => {
		await tx
			.update(user)
			.set({
				name: data.name,
				pronouns: data.pronouns || null,
				phone: data.phone || null,
				updatedAt: new Date()
			})
			.where(eq(user.id, id));

		await tx.delete(modelHasRole).where(eq(modelHasRole.userId, id));

		if (roleIds.length > 0) {
			await tx.insert(modelHasRole).values(
				roleIds.map((roleId: number) => ({
					roleId,
					userId: id
				}))
			);
		}
	});

	void getUser(id).refresh();

	return { success: true };
});

export const adjustCredits = form(
	z.object({
		userId: z.string(),
		creditType: z.enum(['free_hours', 'equipment_credits']),
		amount: z.string(),
		description: z.string().min(1)
	}),
	async (data) => {
		await requireStaff();

		const userId = data.userId as string;
		const type = data.creditType as CreditType;
		const amount = Number(data.amount);
		const description = data.description as string;

		if (amount === 0) throw error(400, 'Amount cannot be zero');

		if (amount > 0) {
			await addCredits(userId, type, amount, 'admin_adjustment', undefined, description);
		} else {
			await deductCredits(
				userId,
				type,
				Math.abs(amount),
				'admin_adjustment',
				undefined,
				description
			);
		}

		void getUserCredits(userId).refresh();
		return { success: true };
	}
);

export const getLocalUser = query(async () => {
	const { locals } = await getRequestEvent();

	return locals.user;
});

// ---------------------------------------------------------------------------
// Member dashboard
// ---------------------------------------------------------------------------

const TZ = DEFAULT_TIMEZONE;

export const getMemberDashboard = query(async () => {
	const currentUser = requireUser();

	const nowDate = new Date();
	const weekStart = startOfWeek(nowDate, { weekStartsOn: 1 });
	const weekEnd = endOfWeek(nowDate, { weekStartsOn: 1 });

	const userBands = await db
		.select({ bandId: bandMember.bandId, bandName: band.name })
		.from(bandMember)
		.innerJoin(band, eq(band.id, bandMember.bandId))
		.where(and(eq(bandMember.userId, currentUser.id), eq(bandMember.status, 'active')));

	const activeBandIds = userBands.map((b) => b.bandId);
	const bandNameMap = Object.fromEntries(userBands.map((b) => [b.bandId, b.bandName]));

	const [{ count: pendingInviteCount }] = await db
		.select({ count: sql<number>`cast(count(*) as integer)` })
		.from(bandMember)
		.where(and(eq(bandMember.userId, currentUser.id), eq(bandMember.status, 'pending')));

	const [weekReservations, bandWeekReservations, upcomingEvents, credits, subscription] =
		await Promise.all([
			db
				.select()
				.from(reservation)
				.where(
					and(
						eq(reservation.createdByUserId, currentUser.id),
						eq(reservation.bookerType, 'user'),
						gte(reservation.startsAt, weekStart),
						lte(reservation.startsAt, weekEnd),
						ne(reservation.status, 'cancelled')
					)
				)
				.orderBy(reservation.startsAt),
			activeBandIds.length > 0
				? db
						.select()
						.from(reservation)
						.where(
							and(
								eq(reservation.bookerType, 'band'),
								inArray(reservation.bookerId, activeBandIds),
								gte(reservation.startsAt, weekStart),
								lte(reservation.startsAt, weekEnd),
								ne(reservation.status, 'cancelled')
							)
						)
						.orderBy(reservation.startsAt)
				: Promise.resolve([]),
			listUpcoming(4),
			getAllBalances(currentUser.id),
			currentUser.stripeId ? getSubscription(currentUser.stripeId) : Promise.resolve(null)
		]);

	const allReservations = [...weekReservations, ...bandWeekReservations].sort(
		(a, b) => a.startsAt.getTime() - b.startsAt.getTime()
	);

	let allocatedThisMonth = 0;
	if (subscription && credits.free_hours != null) {
		allocatedThisMonth = subscription.quantity;
	}
	const usedThisMonth = Math.max(0, allocatedThisMonth - (credits.free_hours ?? 0));

	return {
		weekReservations: allReservations.map((r) => ({
			id: r.id,
			bookerType: r.bookerType,
			bookerId: r.bookerId,
			bandName: r.bookerType === 'band' ? (bandNameMap[r.bookerId] ?? null) : null,
			status: r.status,
			startsAt: r.startsAt,
			endsAt: r.endsAt,
			notes: r.notes
		})),
		upcomingEvents: upcomingEvents.map((e) => ({
			id: e.id,
			title: e.title,
			startsAt: e.startsAt,
			endsAt: e.endsAt,
			doorsAt: e.doorsAt ? e.doorsAt : null,
			posterUrl: resolveImageUrl(e.posterKey)
		})),
		credits,
		subscription,
		allocatedThisMonth,
		usedThisMonth,
		pendingInviteCount
	};
});
