import { sqliteTable, text, integer, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { timestamp, uuid, type Serialized } from './columns';
import { user } from './auth';

// ---------------------------------------------------------------------------
// Equipment domain types
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
	categoryId: z.uuid(),
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
	equipmentId: z.uuid().optional(),
	quantity: z.coerce.number().int().min(1).default(1),
	requestedPickupDate: z.coerce.date(),
	estimatedReturnDate: z.coerce.date(),
	memberNotes: z.string().max(1000).optional()
});

export const scheduleLoanSchema = z.object({
	equipmentId: z.uuid(),
	scheduledPickupDate: z.coerce.date()
});

export const checkoutLoanSchema = z.object({
	dueDate: z.coerce.date()
});

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const equipmentCategory = sqliteTable('equipment_category', {
	id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull().unique(),
	displayOrder: integer('display_order').notNull().default(0),
	pricingTier: text('pricing_tier').notNull(),
	createdAt: timestamp('created_at').notNull().default(sql`(current_timestamp)`),
	updatedAt: timestamp('updated_at').notNull().default(sql`(current_timestamp)`)
});

export const equipment = sqliteTable(
	'equipment',
	{
		id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		name: text('name').notNull(),
		description: text('description'),
		categoryId: text('category_id')
			.notNull()
			.references(() => equipmentCategory.id, { onDelete: 'restrict' }),
		totalQuantity: integer('total_quantity').notNull().default(1),
		outOfOrderQuantity: integer('out_of_order_quantity').notNull().default(0),
		serialNumber: text('serial_number'),
		resourceId: text('resource_id'),
		condition: text('condition').notNull(),
		status: text('status').notNull().default('available'),
		notes: text('notes'),
		imageUrl: text('image_url'),
		createdAt: timestamp('created_at').notNull().default(sql`(current_timestamp)`),
		updatedAt: timestamp('updated_at').notNull().default(sql`(current_timestamp)`),
		deletedAt: timestamp('deleted_at')
	},
	(t) => [
		index('idx_equipment_category').on(t.categoryId),
		index('idx_equipment_status').on(t.status),
		index('idx_equipment_resource_id')
			.on(t.resourceId)
			.where(sql`resource_id IS NOT NULL`),
		check('equipment_qty_positive', sql`total_quantity > 0`),
		check(
			'equipment_ooo_valid',
			sql`out_of_order_quantity >= 0 AND out_of_order_quantity <= total_quantity`
		)
	]
);

export const equipmentLoan = sqliteTable(
	'equipment_loan',
	{
		id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		equipmentId: text('equipment_id').references(() => equipment.id, { onDelete: 'set null' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		quantity: integer('quantity').notNull().default(1),
		requestedPickupDate: timestamp('requested_pickup_date').notNull(),
		estimatedReturnDate: timestamp('estimated_return_date'),
		scheduledPickupDate: timestamp('scheduled_pickup_date'),
		dueDate: timestamp('due_date'),
		checkedOutAt: timestamp('checked_out_at'),
		returnedAt: timestamp('returned_at'),
		status: text('status').notNull().default('requested'),
		dailyRateCents: integer('daily_rate_cents'),
		estimatedCostCents: integer('estimated_cost_cents'),
		totalChargeCents: integer('total_charge_cents'),
		creditsCents: integer('credits_cents'),
		cashCents: integer('cash_cents'),
		memberNotes: text('member_notes'),
		staffNotes: text('staff_notes'),
		createdAt: timestamp('created_at').notNull().default(sql`(current_timestamp)`),
		updatedAt: timestamp('updated_at').notNull().default(sql`(current_timestamp)`)
	},
	(t) => [
		index('idx_loan_equipment').on(t.equipmentId),
		index('idx_loan_user').on(t.userId),
		index('idx_loan_status').on(t.status),
		check('loan_qty_positive', sql`quantity > 0`)
	]
);

// ---------------------------------------------------------------------------
// Client-safe serialized types
// ---------------------------------------------------------------------------

export type Equipment = Serialized<typeof equipment.$inferSelect>;
export type EquipmentCategory = Serialized<typeof equipmentCategory.$inferSelect>;
export type EquipmentLoan = Serialized<typeof equipmentLoan.$inferSelect>;