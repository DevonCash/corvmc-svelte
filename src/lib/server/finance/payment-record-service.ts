import { db } from '$lib/server/db';
import { paymentRecord } from '$lib/server/db/schema/finance';
import { user } from '$lib/server/db/schema/auth';
import { eq, desc, and, gte, lte, ilike, or, sql, type SQL } from 'drizzle-orm';
import { buildDateInTz } from '$lib/server/reservation/timezone';

const TZ = 'America/Los_Angeles';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaymentRecordRow {
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

export interface PaymentRecordFilters {
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
	id: paymentRecord.id,
	userId: paymentRecord.userId,
	userName: user.name,
	userEmail: user.email,
	reservationId: paymentRecord.reservationId,
	stripeCustomerId: paymentRecord.stripeCustomerId,
	amountCents: paymentRecord.amountCents,
	currency: paymentRecord.currency,
	paymentMethod: paymentRecord.paymentMethod,
	status: paymentRecord.status,
	paidAt: paymentRecord.paidAt,
	refundedAt: paymentRecord.refundedAt
};

/** Escape LIKE/ILIKE wildcards so user input is treated literally. */
function escapeLike(input: string): string {
	return input.replace(/[%_\\]/g, (ch) => `\\${ch}`);
}

function buildFilters(filters: PaymentRecordFilters): SQL[] {
	const conditions: SQL[] = [];

	if (filters.search) {
		const escaped = escapeLike(filters.search);
		conditions.push(
			or(
				ilike(user.name, `%${escaped}%`),
				ilike(user.email, `%${escaped}%`)
			)!
		);
	}

	if (filters.method) {
		conditions.push(eq(paymentRecord.paymentMethod, filters.method));
	}

	if (filters.status) {
		conditions.push(eq(paymentRecord.status, filters.status));
	}

	if (filters.from) {
		conditions.push(gte(paymentRecord.paidAt, buildDateInTz(filters.from, '00:00', TZ)));
	}

	if (filters.to) {
		conditions.push(lte(paymentRecord.paidAt, buildDateInTz(filters.to, '23:59', TZ)));
	}

	return conditions;
}

function serialize(row: {
	id: string;
	paidAt: Date;
	refundedAt: Date | null;
	[key: string]: unknown;
}): PaymentRecordRow {
	return {
		...row,
		paidAt: row.paidAt.toISOString(),
		refundedAt: row.refundedAt?.toISOString() ?? null
	} as PaymentRecordRow;
}

/** Paginated list of all payment records with optional filters. */
export async function list(
	filters: PaymentRecordFilters = {},
	limit = 50,
	offset = 0
): Promise<{ rows: PaymentRecordRow[]; total: number }> {
	const conditions = buildFilters(filters);
	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const rows = await db
		.select(baseSelect)
		.from(paymentRecord)
		.innerJoin(user, eq(user.id, paymentRecord.userId))
		.where(where)
		.orderBy(desc(paymentRecord.paidAt))
		.limit(limit)
		.offset(offset);

	const [countRow] = await db
		.select({ count: sql<number>`cast(count(*) as int)` })
		.from(paymentRecord)
		.innerJoin(user, eq(user.id, paymentRecord.userId))
		.where(where);

	return {
		rows: rows.map(serialize),
		total: countRow?.count ?? 0
	};
}

/** All payment records for a specific user, ordered by most recent. */
export async function listByUser(userId: string): Promise<PaymentRecordRow[]> {
	const rows = await db
		.select(baseSelect)
		.from(paymentRecord)
		.innerJoin(user, eq(user.id, paymentRecord.userId))
		.where(eq(paymentRecord.userId, userId))
		.orderBy(desc(paymentRecord.paidAt));

	return rows.map(serialize);
}
