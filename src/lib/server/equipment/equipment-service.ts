import { db } from '$lib/server/db';
import { equipment, equipmentCategory, equipmentLoan } from '$lib/server/db/schema/equipment';
import { eq, and, sql, ilike, isNull, or, inArray } from 'drizzle-orm';
import type { PricingTier, EquipmentCondition, EquipmentStatus } from './types';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class EquipmentNotFoundError extends Error {
	constructor() {
		super('Equipment not found');
		this.name = 'EquipmentNotFoundError';
	}
}

export class CategoryNotFoundError extends Error {
	constructor() {
		super('Category not found');
		this.name = 'CategoryNotFoundError';
	}
}

export class CategoryHasEquipmentError extends Error {
	constructor() {
		super('Cannot delete category that has equipment assigned');
		this.name = 'CategoryHasEquipmentError';
	}
}

// ---------------------------------------------------------------------------
// Category CRUD
// ---------------------------------------------------------------------------

export async function createCategory(data: {
	name: string;
	displayOrder?: number;
	pricingTier: PricingTier;
}) {
	const [row] = await db
		.insert(equipmentCategory)
		.values({
			name: data.name,
			displayOrder: data.displayOrder ?? 0,
			pricingTier: data.pricingTier
		})
		.returning();
	return row;
}

export async function updateCategory(
	id: string,
	data: { name?: string; displayOrder?: number; pricingTier?: PricingTier }
) {
	const updates: Record<string, unknown> = { updatedAt: new Date() };
	if (data.name !== undefined) updates.name = data.name;
	if (data.displayOrder !== undefined) updates.displayOrder = data.displayOrder;
	if (data.pricingTier !== undefined) updates.pricingTier = data.pricingTier;

	const [row] = await db
		.update(equipmentCategory)
		.set(updates)
		.where(eq(equipmentCategory.id, id))
		.returning();

	if (!row) throw new CategoryNotFoundError();
	return row;
}

export async function deleteCategory(id: string) {
	const [hasEquipment] = await db
		.select({ id: equipment.id })
		.from(equipment)
		.where(and(eq(equipment.categoryId, id), isNull(equipment.deletedAt)))
		.limit(1);

	if (hasEquipment) throw new CategoryHasEquipmentError();

	const [row] = await db
		.delete(equipmentCategory)
		.where(eq(equipmentCategory.id, id))
		.returning();

	if (!row) throw new CategoryNotFoundError();
	return row;
}

export async function listCategories() {
	return db
		.select()
		.from(equipmentCategory)
		.orderBy(equipmentCategory.displayOrder, equipmentCategory.name);
}

export async function getCategoryById(id: string) {
	const [row] = await db
		.select()
		.from(equipmentCategory)
		.where(eq(equipmentCategory.id, id))
		.limit(1);
	return row ?? null;
}

// ---------------------------------------------------------------------------
// Equipment CRUD
// ---------------------------------------------------------------------------

export interface CreateEquipmentData {
	name: string;
	description?: string;
	categoryId: string;
	totalQuantity?: number;
	outOfOrderQuantity?: number;
	serialNumber?: string;
	resourceId?: string;
	condition: EquipmentCondition;
	status?: EquipmentStatus;
	notes?: string;
}

export async function createEquipment(data: CreateEquipmentData) {
	const [row] = await db
		.insert(equipment)
		.values({
			name: data.name,
			description: data.description ?? null,
			categoryId: data.categoryId,
			totalQuantity: data.totalQuantity ?? 1,
			outOfOrderQuantity: data.outOfOrderQuantity ?? 0,
			serialNumber: data.serialNumber ?? null,
			resourceId: data.resourceId ?? null,
			condition: data.condition,
			status: data.status ?? 'available',
			notes: data.notes ?? null
		})
		.returning();
	return row;
}

export async function updateEquipment(
	id: string,
	data: Partial<CreateEquipmentData>
) {
	const updates: Record<string, unknown> = { updatedAt: new Date() };
	if (data.name !== undefined) updates.name = data.name;
	if (data.description !== undefined) updates.description = data.description || null;
	if (data.categoryId !== undefined) updates.categoryId = data.categoryId;
	if (data.totalQuantity !== undefined) updates.totalQuantity = data.totalQuantity;
	if (data.outOfOrderQuantity !== undefined) updates.outOfOrderQuantity = data.outOfOrderQuantity;
	if (data.serialNumber !== undefined) updates.serialNumber = data.serialNumber || null;
	if (data.resourceId !== undefined) updates.resourceId = data.resourceId || null;
	if (data.condition !== undefined) updates.condition = data.condition;
	if (data.status !== undefined) updates.status = data.status;
	if (data.notes !== undefined) updates.notes = data.notes || null;

	const [row] = await db
		.update(equipment)
		.set(updates)
		.where(and(eq(equipment.id, id), isNull(equipment.deletedAt)))
		.returning();

	if (!row) throw new EquipmentNotFoundError();
	return row;
}

export async function softDeleteEquipment(id: string) {
	const [row] = await db
		.update(equipment)
		.set({ deletedAt: new Date(), updatedAt: new Date() })
		.where(and(eq(equipment.id, id), isNull(equipment.deletedAt)))
		.returning();

	if (!row) throw new EquipmentNotFoundError();
	return row;
}

export async function restoreEquipment(id: string) {
	const [row] = await db
		.update(equipment)
		.set({ deletedAt: null, updatedAt: new Date() })
		.where(eq(equipment.id, id))
		.returning();

	if (!row) throw new EquipmentNotFoundError();
	return row;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const activeLoansSubquery = db
	.select({
		equipmentId: equipmentLoan.equipmentId,
		loanedQty: sql<number>`COALESCE(SUM(${equipmentLoan.quantity}), 0)`.as('loaned_qty')
	})
	.from(equipmentLoan)
	.where(inArray(equipmentLoan.status, ['scheduled', 'checked_out']))
	.groupBy(equipmentLoan.equipmentId)
	.as('active_loans');

export async function getEquipmentById(id: string) {
	const [row] = await db
		.select({
			equipment: equipment,
			category: equipmentCategory,
			loanedQty: sql<number>`COALESCE(${activeLoansSubquery.loanedQty}, 0)`
		})
		.from(equipment)
		.innerJoin(equipmentCategory, eq(equipment.categoryId, equipmentCategory.id))
		.leftJoin(activeLoansSubquery, eq(equipment.id, activeLoansSubquery.equipmentId))
		.where(and(eq(equipment.id, id), isNull(equipment.deletedAt)))
		.limit(1);

	if (!row) return null;

	return {
		...row.equipment,
		category: row.category,
		loanedQuantity: Number(row.loanedQty),
		availableQuantity:
			row.equipment.totalQuantity - row.equipment.outOfOrderQuantity - Number(row.loanedQty)
	};
}

export interface ListEquipmentOptions {
	search?: string;
	categoryId?: string;
	status?: string;
	includeDeleted?: boolean;
}

export async function listEquipment(opts: ListEquipmentOptions = {}) {
	const conditions = [];

	if (!opts.includeDeleted) {
		conditions.push(isNull(equipment.deletedAt));
	}
	if (opts.categoryId) {
		conditions.push(eq(equipment.categoryId, opts.categoryId));
	}
	if (opts.status) {
		conditions.push(eq(equipment.status, opts.status));
	}
	if (opts.search) {
		conditions.push(
			or(
				ilike(equipment.name, `%${opts.search}%`),
				ilike(equipment.serialNumber, `%${opts.search}%`),
				ilike(equipment.resourceId, `%${opts.search}%`)
			)
		);
	}

	const rows = await db
		.select({
			equipment: equipment,
			category: equipmentCategory,
			loanedQty: sql<number>`COALESCE(${activeLoansSubquery.loanedQty}, 0)`
		})
		.from(equipment)
		.innerJoin(equipmentCategory, eq(equipment.categoryId, equipmentCategory.id))
		.leftJoin(activeLoansSubquery, eq(equipment.id, activeLoansSubquery.equipmentId))
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(equipmentCategory.displayOrder, equipment.name);

	return rows.map((row) => ({
		...row.equipment,
		category: row.category,
		loanedQuantity: Number(row.loanedQty),
		availableQuantity:
			row.equipment.totalQuantity - row.equipment.outOfOrderQuantity - Number(row.loanedQty)
	}));
}

export async function getAvailableQuantity(equipmentId: string): Promise<number> {
	const item = await getEquipmentById(equipmentId);
	if (!item) return 0;
	return item.availableQuantity;
}
