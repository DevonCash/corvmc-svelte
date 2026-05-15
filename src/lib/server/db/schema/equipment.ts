import { pgTable, text, timestamp, uuid, index, integer, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth';

export const equipmentCategory = pgTable('equipment_category', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull().unique(),
	displayOrder: integer('display_order').notNull().default(0),
	pricingTier: text('pricing_tier').notNull(), // 'major' | 'accessory'
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const equipment = pgTable(
	'equipment',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		name: text('name').notNull(),
		description: text('description'),
		categoryId: uuid('category_id')
			.notNull()
			.references(() => equipmentCategory.id, { onDelete: 'restrict' }),
		totalQuantity: integer('total_quantity').notNull().default(1),
		outOfOrderQuantity: integer('out_of_order_quantity').notNull().default(0),
		serialNumber: text('serial_number'),
		resourceId: text('resource_id'),
		condition: text('condition').notNull(), // 'excellent' | 'good' | 'fair' | 'poor'
		status: text('status').notNull().default('available'), // 'available' | 'maintenance' | 'retired'
		notes: text('notes'),
		imageUrl: text('image_url'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
		deletedAt: timestamp('deleted_at', { withTimezone: true })
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

export const equipmentLoan = pgTable(
	'equipment_loan',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		equipmentId: uuid('equipment_id').references(() => equipment.id, { onDelete: 'set null' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		quantity: integer('quantity').notNull().default(1),
		requestedPickupDate: timestamp('requested_pickup_date', { withTimezone: true }).notNull(),
		scheduledPickupDate: timestamp('scheduled_pickup_date', { withTimezone: true }),
		dueDate: timestamp('due_date', { withTimezone: true }),
		checkedOutAt: timestamp('checked_out_at', { withTimezone: true }),
		returnedAt: timestamp('returned_at', { withTimezone: true }),
		status: text('status').notNull().default('requested'), // 'requested' | 'scheduled' | 'checked_out' | 'returned' | 'cancelled'
		dailyRateCents: integer('daily_rate_cents'),
		totalChargeCents: integer('total_charge_cents'),
		creditsCents: integer('credits_cents'),
		cashCents: integer('cash_cents'),
		memberNotes: text('member_notes'),
		staffNotes: text('staff_notes'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('idx_loan_equipment').on(t.equipmentId),
		index('idx_loan_user').on(t.userId),
		index('idx_loan_status').on(t.status),
		check('loan_qty_positive', sql`quantity > 0`)
	]
);
