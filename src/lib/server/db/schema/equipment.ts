import { sqliteTable, text, integer, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { timestamp, uuid } from './columns';
import { user } from './auth';

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