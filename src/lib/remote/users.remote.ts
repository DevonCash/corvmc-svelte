import { z } from 'zod';
import { SHORT_TEXT_MAX } from '$lib/config';
import { mapDomainError } from '$lib/server/errors';
import { error } from '@sveltejs/kit';
import { query, form, getRequestEvent } from '$app/server';
import { requireStaff, requireUser } from '$lib/server/authorization';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/authentication';
import { role, modelHasRole } from '$lib/server/db/schema/authorization';
import { reservation } from '$lib/server/db/schema/reservation';
import { band, bandMember } from '$lib/server/db/schema/band';
import {
	eq,
	or,
	like,
	isNull,
	isNotNull,
	count,
	desc,
	gte,
	lte,
	ne,
	inArray,
	sql,
	and
} from 'drizzle-orm';
import { getUserRoles } from '$lib/server/authorization';
import { isSustainingMemberSql } from '$lib/server/finance/subscription-service';
import { paginate } from '$lib/server/db/paginate';
import { jsonArrayField } from '$lib/utils/zod-json';
import { listByUser, list as listPayments } from '$lib/server/finance/payment-cache-service';
import {
	getAllBalances,
	getUsageSinceLastAllocation,
	addCredits,
	deductCredits,
	listTransactions,
	InsufficientCreditsError
} from '$lib/server/finance/credit-service';
import { getMemberSubscription, mapDbSubscription } from '$lib/server/finance/subscription-service';
import { listUpcoming } from '$lib/server/event/event-service';
import {
	deactivateUser as deactivateUserService,
	deactivateUsers as deactivateUsersService,
	reactivateUser as reactivateUserService,
	purgeUser as purgeUserService
} from '$lib/server/user/user-service';
import { resolveImageUrl } from '$lib/server/storage';
import { isProfileComplete } from '$lib/server/directory/directory-service';
import { startOfWeek, endOfWeek } from 'date-fns';
import type { CreditType } from '$lib/server/db/schema/finance';
import type { BatchItem } from 'drizzle-orm/batch';

// ---------------------------------------------------------------------------
// Staff list queries
// ---------------------------------------------------------------------------

export const getStaffDashboard = query(async () => {
	await requireStaff();
	const startOfMonth = new Date();
	startOfMonth.setDate(1);
	startOfMonth.setHours(0, 0, 0, 0);

	// No `permissions` count: the spatie-derived permission tables are populated by
	// the Postgres migrator and read by nothing in this app, so the stat was always
	// 0. See src/lib/server/db/schema/authorization.ts.
	const [totalUsersResult, totalRolesResult, newUsersResult, recentUsers] = await Promise.all([
		db.select({ value: count() }).from(user),
		db.select({ value: count() }).from(role),
		db.select({ value: count() }).from(user).where(gte(user.createdAt, startOfMonth)),
		db
			.select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt })
			.from(user)
			.orderBy(desc(user.createdAt))
			.limit(5)
	]);

	return {
		stats: {
			totalUsers: totalUsersResult[0].value,
			totalRoles: totalRolesResult[0].value,
			newUsersThisMonth: newUsersResult[0].value
		},
		recentUsers
	};
});

const staffUsersFilters = z.object({
	search: z.string().optional(),
	status: z.enum(['active', 'deactivated', 'all']).optional(),
	page: z.number().optional()
});

export const getStaffUsers = query(staffUsersFilters, async (filters) => {
	await requireStaff();

	const search = filters.search?.trim();
	const searchCondition = search
		? or(like(user.name, `%${search}%`), like(user.email, `%${search}%`))
		: undefined;
	const status = filters.status ?? 'active';
	const statusCondition =
		status === 'active'
			? isNull(user.deletedAt)
			: status === 'deactivated'
				? isNotNull(user.deletedAt)
				: undefined;
	const where =
		searchCondition && statusCondition
			? and(searchCondition, statusCondition)
			: (searchCondition ?? statusCondition);

	const dataQ = db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			pronouns: user.pronouns,
			deletedAt: user.deletedAt,
			createdAt: user.createdAt,
			sustaining: isSustainingMemberSql(user.id)
		})
		.from(user)
		.where(where)
		.orderBy(desc(user.createdAt))
		.$dynamic();

	const countQ = db.select({ count: count() }).from(user).where(where);

	const { rows: users, pagination } = await paginate(dataQ, countQ, {
		page: filters.page ?? 1,
		pageSize: 20
	});

	const userIds = users.map((u) => u.id);
	const roleMap: Record<string, string[]> = {};

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
		rows: users.map((u) => ({ ...u, sustaining: !!u.sustaining, roles: roleMap[u.id] ?? [] })),
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
			source: (filters.source ||
				undefined) as import('$lib/server/finance/credit-service').CreditTransactionFilters['source'],
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
	await requireStaff();
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
	await requireStaff();
	return db.select({ id: role.id, name: role.name }).from(role);
});

export const getUserPayments = query(z.string(), async (userId) => {
	await requireStaff();
	return listByUser(userId);
});

export const getUserCredits = query(z.string(), async (userId) => {
	await requireStaff();
	return getAllBalances(userId);
});

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

const updateUserSchema = z.object({
	// The target is an explicit, validated field rather than `params.id`: for a
	// remote call SvelteKit derives params from the caller-supplied
	// `x-sveltekit-pathname` header, so params are request input, not a
	// trustworthy identifier. Matches deactivateUser/reactivateUser/purgeUser.
	id: z.string().min(1),
	name: z.string().trim().min(1).max(SHORT_TEXT_MAX),
	pronouns: z.string().trim().max(50),
	phone: z.string().trim().max(30),
	// No `.catch([])` here: silently coercing a malformed roles field to an empty
	// array would delete every role on the target user.
	roles: jsonArrayField(
		z.string().regex(/^\d+$/, 'Invalid role ID'),
		'Invalid role selection'
	).default([])
});

export const updateUser = form(updateUserSchema, async (rawData) => {
	const data = rawData as z.infer<typeof updateUserSchema>;
	const actor = await requireStaff();
	const id = data.id;
	const roleIds = data.roles.map(Number);

	// Role changes can lock people out of the panel, and nothing else can undo
	// that from the UI. Two cases are refused outright.
	const namesById = new Map(
		(await db.select({ id: role.id, name: role.name }).from(role)).map((r) => [r.id, r.name])
	);
	const nextRoleNames = roleIds.map((rid) => namesById.get(rid)).filter(Boolean) as string[];
	const targetCurrentRoles = await getUserRoles(id);

	// 1. Don't let staff drop their own staff access.
	if (id === actor.id && !nextRoleNames.some((n) => n === 'admin' || n === 'staff')) {
		error(400, 'You cannot remove your own staff access.');
	}

	// 2. Don't let the last admin be demoted — that leaves nobody able to
	//    restore the role.
	if (targetCurrentRoles.includes('admin') && !nextRoleNames.includes('admin')) {
		const adminRoleId = [...namesById.entries()].find(([, n]) => n === 'admin')?.[0];
		if (adminRoleId !== undefined) {
			const [{ value: adminCount }] = await db
				.select({ value: count() })
				.from(modelHasRole)
				.where(and(eq(modelHasRole.roleId, adminRoleId), ne(modelHasRole.userId, id)));
			if (adminCount === 0) {
				error(409, 'This is the last admin — assign another admin before removing this role.');
			}
		}
	}

	// D1 has no interactive transactions; these writes are independent, so batch
	// them for atomicity (db.batch runs in a single implicit transaction).
	const ops: BatchItem<'sqlite'>[] = [
		db
			.update(user)
			.set({
				name: data.name,
				pronouns: data.pronouns || null,
				phone: data.phone || null,
				updatedAt: new Date()
			})
			.where(eq(user.id, id)),
		db.delete(modelHasRole).where(eq(modelHasRole.userId, id))
	];

	if (roleIds.length > 0) {
		ops.push(
			db.insert(modelHasRole).values(
				roleIds.map((roleId: number) => ({
					roleId,
					userId: id
				}))
			)
		);
	}

	await db.batch(ops as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);

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

		if (!Number.isFinite(amount)) throw error(400, 'Amount must be a number');
		if (amount === 0) throw error(400, 'Amount cannot be zero');

		if (amount > 0) {
			await addCredits(userId, type, amount, 'admin_adjustment', undefined, description);
		} else {
			try {
				await deductCredits(
					userId,
					type,
					Math.abs(amount),
					'admin_adjustment',
					undefined,
					description
				);
			} catch (e) {
				// Deducting more than the member holds is an ordinary staff mistake,
				// not a server fault — surface the balance instead of a 500.
				//
				// Deliberately NOT collapsed into mapDomainError: the mapper classes
				// InsufficientCreditsError as 422 (a business-rule violation) while
				// this call site has always answered 409. Both readings are
				// defensible and the two are not reconcilable without changing one
				// endpoint's contract, so the divergence is left visible here rather
				// than silently resolved. Pick one and delete this comment.
				if (e instanceof InsufficientCreditsError) throw error(409, e.message);
				throw e;
			}
		}

		void getUserCredits(userId).refresh();
		return { success: true };
	}
);

export const deactivateUser = form(
	z.object({
		id: z.string().min(1)
	}),
	async (data) => {
		await requireStaff();
		try {
			await deactivateUserService(data.id);
		} catch (err) {
			mapDomainError(err);
		}
		void getUser(data.id).refresh();
		return { success: true };
	}
);

const bulkDeactivateSchema = z.object({
	ids: jsonArrayField(z.string().min(1), 'Invalid selection').pipe(
		z.array(z.string().min(1)).min(1).max(100)
	)
});

export const bulkDeactivateUsers = form(bulkDeactivateSchema, async (rawData) => {
	await requireStaff();
	const data = rawData as z.infer<typeof bulkDeactivateSchema>;
	const me = requireUser();
	return deactivateUsersService(data.ids, { skipUserId: me.id });
});

export const reactivateUser = form(
	z.object({
		id: z.string().min(1)
	}),
	async (data) => {
		await requireStaff();
		try {
			await reactivateUserService(data.id);
		} catch (err) {
			mapDomainError(err);
		}
		void getUser(data.id).refresh();
		return { success: true };
	}
);

export const purgeUser = form(
	z.object({
		id: z.string().min(1)
	}),
	async (data) => {
		await requireStaff();
		try {
			await purgeUserService(data.id);
		} catch (err) {
			// Every refusal purgeUser can raise carries its own status now, including
			// the published-listings guard that a hand-written ladder here once
			// omitted (and so returned 500). See errors.spec.ts.
			mapDomainError(err);
		}
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

	const [
		weekReservations,
		bandWeekReservations,
		upcomingEvents,
		credits,
		dbSubscription,
		profileComplete
	] = await Promise.all([
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
		getMemberSubscription(currentUser.id),
		isProfileComplete(currentUser.id)
	]);

	const subscription = mapDbSubscription(dbSubscription);

	const allReservations = [...weekReservations, ...bandWeekReservations].sort(
		(a, b) => a.startsAt.getTime() - b.startsAt.getTime()
	);

	// Allocation/usage tracked in credits (30-min blocks); the UI converts to
	// hours. Usage comes from the ledger (see getMemberMembership) with the
	// balance shortcut as fallback when no allocation has ever run.
	const allocatedThisMonth = dbSubscription?.hoursPerReset ?? 0;
	const ledgerUsage = await getUsageSinceLastAllocation(currentUser.id, 'free_hours');
	const usedThisMonth = ledgerUsage ?? Math.max(0, allocatedThisMonth - (credits.free_hours ?? 0));

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
		pendingInviteCount,
		profileComplete
	};
});
