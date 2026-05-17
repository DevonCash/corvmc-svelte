import { db } from '$lib/server/db';
import { paymentCache } from '$lib/server/db/schema/finance';
import { user } from '$lib/server/db/schema/auth';
import { eq, desc, and, gte, lte, like, or, sql, type SQL } from 'drizzle-orm';
import { buildDateInTz } from '$lib/server/reservation/timezone';

const TZ = 'America/Los_Angeles';

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
}

export interface PaymentCacheFilters {
	search?: string;
	method?: string;
	status?: string;
	from?: string; // YYYY-MM-DD
	to?: string;   // YYYY-MM-DD
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
	refundedAt: paymentCache.refundedAt
};

/** Escape LIKE/ILIKE wildcards so user input is treated literally. */
function escapeLike(input: string): string {
	return input.replace(/[%_\\]/g, (ch) => `\\${ch}`);
}

function buildFilters(filters: PaymentCacheFilters): SQL[] {
	const conditions: SQL[] = [];

	if (filters.search) {
		const escaped = escapeLike(filters.search);
		conditions.push(
			or(
				like(user.name, `%${escaped}%`),
				like(user.email, `%${escaped}%`)
			)!
		);
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
	[key: string]: unknown;
}): PaymentCacheRow {
	return {
		...row,
		paidAt: row.paidAt.toISOString(),
		refundedAt: row.refundedAt?.toISOString() ?? null
	} as PaymentCacheRow;
}

/** Paginated list of all payment records with optional filters. */
export async function list(
	filters: PaymentCacheFilters = {},
	limit = 50,
	offset = 0
): Promise<{ rows: PaymentCacheRow[]; total: number }> {
	const conditions = buildFilters(filters);
	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const rows = await db
		.select(baseSelect)
		.from(paymentCache)
		.innerJoin(user, eq(user.id, paymentCache.userId))
		.where(where)
		.orderBy(desc(paymentCache.paidAt))
		.limit(limit)
		.offset(offset);

	const [countRow] = await db
		.select({ count: sql<number>`cast(count(*) as int)` })
		.from(paymentCache)
		.innerJoin(user, eq(user.id, paymentCache.userId))
		.where(where);

	return {
		rows: rows.map(serialize),
		total: countRow?.count ?? 0
	};
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
