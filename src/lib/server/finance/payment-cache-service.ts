import { db } from '$lib/server/db';
import { paymentCache } from '$lib/server/db/schema/finance';
import { user } from '$lib/server/db/schema/authentication';
import { eq, desc, and, gte, lte, like, or, count, type SQL } from 'drizzle-orm';
import { paginate, type PaginationInput, type PaginatedResult } from '$lib/server/db/paginate';
import { buildDateInTz } from '$lib/server/reservation/timezone';
import { DEFAULT_TIMEZONE } from '$lib/config';

const TZ = DEFAULT_TIMEZONE;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaymentCacheRow {
	id: string;
	userId: string;
	userName: string | null;
	userEmail: string;
	reservationId: string | null;
	stripeCustomerId: string;
	amountCents: number;
	currency: string;
	paymentMethod: string;
	status: string;
	paidAt: string; // ISO string
	refundedAt: string | null;
	createdAt: string; // ISO string
}

export interface PaymentCacheFilters {
	search?: string;
	method?: string;
	status?: string;
	from?: string; // YYYY-MM-DD
	to?: string; // YYYY-MM-DD
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const baseSelect = {
	id: paymentCache.id,
	userId: paymentCache.userId,
	userName: user.name,
	userEmail: user.email,
	reservationId: paymentCache.reservationId,
	stripeCustomerId: paymentCache.stripeCustomerId,
	amountCents: paymentCache.amountCents,
	currency: paymentCache.currency,
	paymentMethod: paymentCache.paymentMethod,
	status: paymentCache.status,
	paidAt: paymentCache.paidAt,
	refundedAt: paymentCache.refundedAt,
	createdAt: paymentCache.createdAt
};

/** Escape LIKE/ILIKE wildcards so user input is treated literally. */
function escapeLike(input: string): string {
	return input.replace(/[%_\\]/g, (ch) => `\\${ch}`);
}

function buildFilters(filters: PaymentCacheFilters): SQL[] {
	const conditions: SQL[] = [];

	if (filters.search) {
		const escaped = escapeLike(filters.search);
		conditions.push(or(like(user.name, `%${escaped}%`), like(user.email, `%${escaped}%`))!);
	}

	if (filters.method) {
		conditions.push(eq(paymentCache.paymentMethod, filters.method));
	}

	if (filters.status) {
		conditions.push(eq(paymentCache.status, filters.status));
	}

	if (filters.from) {
		conditions.push(gte(paymentCache.paidAt, buildDateInTz(filters.from, '00:00', TZ)));
	}

	if (filters.to) {
		conditions.push(lte(paymentCache.paidAt, buildDateInTz(filters.to, '23:59', TZ)));
	}

	return conditions;
}

function serialize(row: {
	id: string;
	paidAt: Date;
	refundedAt: Date | null;
	createdAt: Date;
	[key: string]: unknown;
}): PaymentCacheRow {
	return {
		...row,
		paidAt: row.paidAt.toISOString(),
		refundedAt: row.refundedAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString()
	} as PaymentCacheRow;
}

/** Paginated list of all payment records with optional filters. */
export async function list(
	filters: PaymentCacheFilters = {},
	pagination: PaginationInput = {}
): Promise<PaginatedResult<PaymentCacheRow>> {
	const conditions = buildFilters(filters);
	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const dataQ = db
		.select(baseSelect)
		.from(paymentCache)
		.innerJoin(user, eq(user.id, paymentCache.userId))
		.where(where)
		.orderBy(desc(paymentCache.paidAt))
		.$dynamic();

	const countQ = db
		.select({ count: count() })
		.from(paymentCache)
		.innerJoin(user, eq(user.id, paymentCache.userId))
		.where(where);

	const result = await paginate(dataQ, countQ, pagination);
	return { ...result, rows: result.rows.map(serialize) };
}

/** All payment records for a specific user, ordered by most recent. */
export async function listByUser(userId: string): Promise<PaymentCacheRow[]> {
	const rows = await db
		.select(baseSelect)
		.from(paymentCache)
		.innerJoin(user, eq(user.id, paymentCache.userId))
		.where(eq(paymentCache.userId, userId))
		.orderBy(desc(paymentCache.paidAt));

	return rows.map(serialize);
}
