import { db } from '$lib/server/db';
import { equipmentLoan, equipment, equipmentCategory } from '$lib/server/db/schema/equipment';
import { user } from '$lib/server/db/schema/auth';
import { eq, and, sql, like, inArray, or, desc } from 'drizzle-orm';
import { primaryRoleFor } from '$lib/server/authorization';
import { domainEvents } from '$lib/server/events/event-bus';
import { getBalance, deductCredits } from '$lib/server/finance/credit-service';
import { InsufficientCreditsError } from '$lib/server/finance/credit-service';
import { recordCashPayment } from '$lib/server/finance/payment-service';
import { getSubscription } from '$lib/server/finance/subscription-service';
import { getAvailableQuantity } from './equipment-service';
import { DAILY_RATE_MAJOR, DAILY_RATE_ACCESSORY, type PricingTier, type LoanStatus, estimateLoanCost } from './types';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class LoanNotFoundError extends Error {
	constructor() {
		super('Loan not found');
		this.name = 'LoanNotFoundError';
	}
}

export class InvalidLoanTransitionError extends Error {
	constructor(from: string, to: string) {
		super(`Cannot transition loan from '${from}' to '${to}'`);
		this.name = 'InvalidLoanTransitionError';
	}
}

export class InsufficientQuantityError extends Error {
	constructor(available: number, requested: number) {
		super(`Only ${available} available, requested ${requested}`);
		this.name = 'InsufficientQuantityError';
	}
}

// ---------------------------------------------------------------------------
// Pricing helpers
// ---------------------------------------------------------------------------

export function calculateDailyRate(pricingTier: PricingTier, isSustainingMember: boolean): number {
	if (pricingTier === 'accessory' && isSustainingMember) return 0;
	return pricingTier === 'major' ? DAILY_RATE_MAJOR : DAILY_RATE_ACCESSORY;
}

export function calculateLoanCharge(dailyRateCents: number, checkedOutAt: Date, returnedAt: Date): number {
	const ms = returnedAt.getTime() - checkedOutAt.getTime();
	const days = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
	return dailyRateCents * days;
}

async function isSustainingMember(userId: string): Promise<boolean> {
	const [row] = await db
		.select({ stripeId: user.stripeId })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);

	if (!row?.stripeId) return false;
	const sub = await getSubscription(row.stripeId);
	return sub !== null;
}

async function settleReturn(
	userId: string,
	stripeCustomerId: string | null,
	totalCents: number,
	loanId: string
): Promise<{ creditsCents: number; cashCents: number }> {
	if (totalCents <= 0) return { creditsCents: 0, cashCents: 0 };

	const creditBalance = await getBalance(userId, 'equipment_credits');
	const creditsToUse = Math.min(creditBalance, totalCents);
	const cashRemaining = totalCents - creditsToUse;

	if (creditsToUse > 0) {
		try {
			await deductCredits(
				userId,
				'equipment_credits',
				creditsToUse,
				'checkout',
				loanId,
				`Equipment loan ${loanId}`
			);
		} catch (err) {
			if (err instanceof InsufficientCreditsError) {
				// Race condition — fall back to full cash
				if (stripeCustomerId) {
					await recordCashPayment({
						userId,
						stripeCustomerId,
						amountCents: totalCents,
						metadata: { equipment_loan_id: loanId }
					});
				}
				return { creditsCents: 0, cashCents: totalCents };
			}
			throw err;
		}
	}

	if (cashRemaining > 0 && stripeCustomerId) {
		await recordCashPayment({
			userId,
			stripeCustomerId,
			amountCents: cashRemaining,
			metadata: { equipment_loan_id: loanId }
		});
	}

	return { creditsCents: creditsToUse, cashCents: cashRemaining };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export interface RequestLoanData {
	equipmentId?: string;
	quantity?: number;
	requestedPickupDate: Date;
	estimatedReturnDate: Date;
	memberNotes?: string;
}

export async function requestLoan(userId: string, data: RequestLoanData) {
	const qty = data.quantity ?? 1;

	if (data.estimatedReturnDate <= data.requestedPickupDate) {
		throw new Error('Estimated return date must be after the pickup date');
	}

	if (data.equipmentId) {
		const available = await getAvailableQuantity(data.equipmentId);
		if (available < qty) {
			throw new InsufficientQuantityError(available, qty);
		}
	}

	let estimatedCostCents: number | null = null;
	if (data.equipmentId) {
		const [item] = await db
			.select({ pricingTier: equipmentCategory.pricingTier })
			.from(equipment)
			.innerJoin(equipmentCategory, eq(equipment.categoryId, equipmentCategory.id))
			.where(eq(equipment.id, data.equipmentId))
			.limit(1);

		if (item) {
			const sustaining = await isSustainingMember(userId);
			estimatedCostCents = estimateLoanCost(
				data.requestedPickupDate,
				data.estimatedReturnDate,
				item.pricingTier as PricingTier,
				sustaining
			);
		}
	}

	const [loan] = await db
		.insert(equipmentLoan)
		.values({
			equipmentId: data.equipmentId ?? null,
			userId,
			quantity: qty,
			requestedPickupDate: data.requestedPickupDate,
			estimatedReturnDate: data.estimatedReturnDate,
			estimatedCostCents,
			memberNotes: data.memberNotes ?? null,
			status: 'requested'
		})
		.returning();

	// Fetch user info for event
	const [member] = await db
		.select({ name: user.name, email: user.email })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);

	let equipmentName: string | null = null;
	if (data.equipmentId) {
		const [item] = await db
			.select({ name: equipment.name })
			.from(equipment)
			.where(eq(equipment.id, data.equipmentId))
			.limit(1);
		equipmentName = item?.name ?? null;
	}

	Promise.resolve().then(async () => {
		try {
			await domainEvents.emit('equipment.loan_requested', {
				loanId: loan.id,
				userId,
				userName: member?.name ?? 'Unknown',
				userEmail: member?.email ?? '',
				equipmentName,
				memberNotes: data.memberNotes ?? null,
				requestedPickupDate: data.requestedPickupDate.toISOString()
			});
		} catch (err) {
			console.error('[events] equipment.loan_requested emission failed:', err);
		}
	});

	return loan;
}

export interface ScheduleLoanData {
	equipmentId: string;
	scheduledPickupDate: Date;
}

export async function scheduleLoan(loanId: string, data: ScheduleLoanData) {
	const loan = await getLoanRaw(loanId);
	if (!loan) throw new LoanNotFoundError();
	if (loan.status !== 'requested') throw new InvalidLoanTransitionError(loan.status, 'scheduled');

	const available = await getAvailableQuantity(data.equipmentId);
	if (available < loan.quantity) {
		throw new InsufficientQuantityError(available, loan.quantity);
	}

	const [updated] = await db
		.update(equipmentLoan)
		.set({
			equipmentId: data.equipmentId,
			scheduledPickupDate: data.scheduledPickupDate,
			status: 'scheduled',
			updatedAt: new Date()
		})
		.where(eq(equipmentLoan.id, loanId))
		.returning();

	const [member] = await db
		.select({ name: user.name, email: user.email })
		.from(user)
		.where(eq(user.id, loan.userId))
		.limit(1);

	const [item] = await db
		.select({ name: equipment.name })
		.from(equipment)
		.where(eq(equipment.id, data.equipmentId))
		.limit(1);

	Promise.resolve().then(async () => {
		try {
			await domainEvents.emit('equipment.loan_scheduled', {
				loanId,
				userId: loan.userId,
				userName: member?.name ?? 'Unknown',
				userEmail: member?.email ?? '',
				equipmentName: item?.name ?? 'Unknown',
				scheduledPickupDate: data.scheduledPickupDate.toISOString()
			});
		} catch (err) {
			console.error('[events] equipment.loan_scheduled emission failed:', err);
		}
	});

	return updated;
}

export interface CheckoutLoanData {
	dueDate: Date;
}

export async function checkoutLoan(loanId: string, data: CheckoutLoanData) {
	const loan = await getLoanRaw(loanId);
	if (!loan) throw new LoanNotFoundError();
	if (loan.status !== 'scheduled') throw new InvalidLoanTransitionError(loan.status, 'checked_out');
	if (!loan.equipmentId) throw new Error('Loan must have equipment assigned before checkout');

	const [item] = await db
		.select({
			name: equipment.name,
			pricingTier: equipmentCategory.pricingTier
		})
		.from(equipment)
		.innerJoin(equipmentCategory, eq(equipment.categoryId, equipmentCategory.id))
		.where(eq(equipment.id, loan.equipmentId))
		.limit(1);

	const sustaining = await isSustainingMember(loan.userId);
	const dailyRate = calculateDailyRate(item.pricingTier as PricingTier, sustaining);

	const [updated] = await db
		.update(equipmentLoan)
		.set({
			checkedOutAt: new Date(),
			dueDate: data.dueDate,
			dailyRateCents: dailyRate,
			status: 'checked_out',
			updatedAt: new Date()
		})
		.where(eq(equipmentLoan.id, loanId))
		.returning();

	Promise.resolve().then(async () => {
		try {
			await domainEvents.emit('equipment.checked_out', {
				loanId,
				userId: loan.userId,
				equipmentName: item?.name ?? 'Unknown'
			});
		} catch (err) {
			console.error('[events] equipment.checked_out emission failed:', err);
		}
	});

	return updated;
}

export async function returnLoan(loanId: string, staffNotes?: string) {
	const loan = await getLoanRaw(loanId);
	if (!loan) throw new LoanNotFoundError();
	if (loan.status !== 'checked_out') throw new InvalidLoanTransitionError(loan.status, 'returned');

	const now = new Date();
	const totalCharge = calculateLoanCharge(loan.dailyRateCents ?? 0, loan.checkedOutAt!, now);

	const [member] = await db
		.select({ name: user.name, stripeId: user.stripeId })
		.from(user)
		.where(eq(user.id, loan.userId))
		.limit(1);

	const { creditsCents, cashCents } = await settleReturn(
		loan.userId,
		member?.stripeId ?? null,
		totalCharge,
		loanId
	);

	const [updated] = await db
		.update(equipmentLoan)
		.set({
			returnedAt: now,
			status: 'returned',
			totalChargeCents: totalCharge,
			creditsCents,
			cashCents,
			staffNotes: staffNotes ?? loan.staffNotes,
			updatedAt: now
		})
		.where(eq(equipmentLoan.id, loanId))
		.returning();

	let equipmentName = 'Unknown';
	if (loan.equipmentId) {
		const [item] = await db
			.select({ name: equipment.name })
			.from(equipment)
			.where(eq(equipment.id, loan.equipmentId))
			.limit(1);
		equipmentName = item?.name ?? 'Unknown';
	}

	const daysBorrowed = Math.max(
		1,
		Math.ceil((now.getTime() - loan.checkedOutAt!.getTime()) / (1000 * 60 * 60 * 24))
	);

	Promise.resolve().then(async () => {
		try {
			await domainEvents.emit('equipment.returned', {
				loanId,
				userId: loan.userId,
				userName: member?.name ?? 'Unknown',
				equipmentName,
				totalChargeCents: totalCharge,
				creditsCents,
				cashCents,
				daysBorrowed
			});
		} catch (err) {
			console.error('[events] equipment.returned emission failed:', err);
		}
	});

	return updated;
}

export async function cancelLoan(loanId: string) {
	const loan = await getLoanRaw(loanId);
	if (!loan) throw new LoanNotFoundError();
	if (loan.status !== 'requested' && loan.status !== 'scheduled') {
		throw new InvalidLoanTransitionError(loan.status, 'cancelled');
	}

	const [updated] = await db
		.update(equipmentLoan)
		.set({ status: 'cancelled', updatedAt: new Date() })
		.where(eq(equipmentLoan.id, loanId))
		.returning();

	return updated;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

async function getLoanRaw(id: string) {
	const [row] = await db
		.select()
		.from(equipmentLoan)
		.where(eq(equipmentLoan.id, id))
		.limit(1);
	return row ?? null;
}

export async function getLoanById(id: string) {
	const [row] = await db
		.select({
			loan: equipmentLoan,
			equipmentName: equipment.name,
			categoryName: equipmentCategory.name,
			pricingTier: equipmentCategory.pricingTier,
			userName: user.name,
			userEmail: user.email,
			userPronouns: user.pronouns,
			userRole: primaryRoleFor(user.id)
		})
		.from(equipmentLoan)
		.innerJoin(user, eq(equipmentLoan.userId, user.id))
		.leftJoin(equipment, eq(equipmentLoan.equipmentId, equipment.id))
		.leftJoin(equipmentCategory, eq(equipment.categoryId, equipmentCategory.id))
		.where(eq(equipmentLoan.id, id))
		.limit(1);

	if (!row) return null;

	return {
		...row.loan,
		equipmentName: row.equipmentName,
		categoryName: row.categoryName,
		pricingTier: row.pricingTier,
		userName: row.userName,
		userEmail: row.userEmail,
		userPronouns: row.userPronouns,
		userRole: row.userRole,
		isOverdue:
			row.loan.status === 'checked_out' &&
			row.loan.dueDate != null &&
			row.loan.dueDate < new Date()
	};
}

export interface ListLoansOptions {
	status?: LoanStatus;
	userId?: string;
	equipmentId?: string;
	search?: string;
}

export async function listLoans(opts: ListLoansOptions = {}) {
	const conditions = [];

	if (opts.status) conditions.push(eq(equipmentLoan.status, opts.status));
	if (opts.userId) conditions.push(eq(equipmentLoan.userId, opts.userId));
	if (opts.equipmentId) conditions.push(eq(equipmentLoan.equipmentId, opts.equipmentId));
	if (opts.search) {
		conditions.push(
			or(like(user.name, `%${opts.search}%`), like(user.email, `%${opts.search}%`))
		);
	}

	const rows = await db
		.select({
			loan: equipmentLoan,
			equipmentName: equipment.name,
			userName: user.name,
			userEmail: user.email,
			userPronouns: user.pronouns,
			userRole: primaryRoleFor(user.id)
		})
		.from(equipmentLoan)
		.innerJoin(user, eq(equipmentLoan.userId, user.id))
		.leftJoin(equipment, eq(equipmentLoan.equipmentId, equipment.id))
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(equipmentLoan.createdAt));

	return rows.map((row) => ({
		...row.loan,
		equipmentName: row.equipmentName,
		userName: row.userName,
		userEmail: row.userEmail,
		userPronouns: row.userPronouns,
		userRole: row.userRole,
		isOverdue:
			row.loan.status === 'checked_out' &&
			row.loan.dueDate != null &&
			row.loan.dueDate < new Date()
	}));
}

export async function listUserLoans(userId: string) {
	return listLoans({ userId });
}

export async function getLoanHistory(equipmentId: string) {
	return listLoans({ equipmentId });
}
