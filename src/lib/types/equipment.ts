import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const equipmentConditions = ['excellent', 'good', 'fair', 'poor'] as const;
export type EquipmentCondition = (typeof equipmentConditions)[number];

export const equipmentStatuses = ['available', 'maintenance', 'retired'] as const;
export type EquipmentStatus = (typeof equipmentStatuses)[number];

export const pricingTiers = ['major', 'accessory'] as const;
export type PricingTier = (typeof pricingTiers)[number];

export const loanStatuses = ['requested', 'scheduled', 'checked_out', 'returned', 'cancelled'] as const;
export type LoanStatus = (typeof loanStatuses)[number];

export function isEquipmentCondition(value: string): value is EquipmentCondition {
	return equipmentConditions.includes(value as EquipmentCondition);
}

export function isEquipmentStatus(value: string): value is EquipmentStatus {
	return equipmentStatuses.includes(value as EquipmentStatus);
}

export function isPricingTier(value: string): value is PricingTier {
	return pricingTiers.includes(value as PricingTier);
}

export function isLoanStatus(value: string): value is LoanStatus {
	return loanStatuses.includes(value as LoanStatus);
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

export const DAILY_RATE_MAJOR = 500;
export const DAILY_RATE_ACCESSORY = 100;

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const createCategorySchema = z.object({
	name: z.string().min(1).max(100),
	displayOrder: z.coerce.number().int().min(0).default(0),
	pricingTier: z.enum(pricingTiers)
});

export const updateCategorySchema = createCategorySchema.partial();

export const createEquipmentSchema = z.object({
	name: z.string().min(1).max(255),
	description: z.string().max(2000).optional(),
	categoryId: z.string().uuid(),
	totalQuantity: z.coerce.number().int().min(1).default(1),
	outOfOrderQuantity: z.coerce.number().int().min(0).default(0),
	serialNumber: z.string().max(100).optional(),
	resourceId: z.string().max(100).optional(),
	condition: z.enum(equipmentConditions),
	status: z.enum(equipmentStatuses).default('available'),
	notes: z.string().max(2000).optional()
});

export const updateEquipmentSchema = createEquipmentSchema.partial();

export const requestLoanSchema = z.object({
	equipmentId: z.string().uuid().optional(),
	quantity: z.coerce.number().int().min(1).default(1),
	requestedPickupDate: z.coerce.date(),
	estimatedReturnDate: z.coerce.date(),
	memberNotes: z.string().max(1000).optional()
});

// ---------------------------------------------------------------------------
// Cost estimation (shared client/server)
// ---------------------------------------------------------------------------

export function estimateLoanCost(
	pickupDate: Date,
	returnDate: Date,
	pricingTier: PricingTier,
	isSustainingMember: boolean
): number {
	if (pricingTier === 'accessory' && isSustainingMember) return 0;
	const dailyRate = pricingTier === 'major' ? DAILY_RATE_MAJOR : DAILY_RATE_ACCESSORY;
	const ms = returnDate.getTime() - pickupDate.getTime();
	const days = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
	return dailyRate * days;
}

export const scheduleLoanSchema = z.object({
	equipmentId: z.string().uuid(),
	scheduledPickupDate: z.coerce.date()
});

export const checkoutLoanSchema = z.object({
	dueDate: z.coerce.date()
});
