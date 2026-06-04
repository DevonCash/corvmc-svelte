import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let selectResult: unknown[] = [];
let selectResultQueue: unknown[][] = [];
let insertResult: unknown[] = [];
let updateResult: unknown[] = [];
let deleteResult: unknown[] = [];

function chainable(result?: unknown[]) {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				return (resolve: (v: unknown[]) => void) => {
					if (result !== undefined) return resolve(result);
					if (selectResultQueue.length > 0) return resolve(selectResultQueue.shift()!);
					return resolve(selectResult);
				};
			}
			return () => proxy;
		}
	});
	return proxy;
}

vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn(() => chainable()),
		insert: vi.fn(() => ({
			values: vi.fn(() => ({
				returning: vi.fn(() => Promise.resolve(insertResult))
			}))
		})),
		update: vi.fn(() => ({
			set: vi.fn(() => ({
				where: vi.fn(() => ({
					returning: vi.fn(() => Promise.resolve(updateResult))
				}))
			}))
		})),
		delete: vi.fn(() => ({
			where: vi.fn(() => ({
				returning: vi.fn(() => Promise.resolve(deleteResult))
			}))
		}))
	}
}));

import {
	createCategory,
	updateCategory,
	deleteCategory,
	createEquipment,
	updateEquipment,
	softDeleteEquipment,
	restoreEquipment,
	EquipmentNotFoundError,
	CategoryNotFoundError,
	CategoryHasEquipmentError
} from './equipment-service';

describe('EquipmentService', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		selectResult = [];
		selectResultQueue = [];
		insertResult = [];
		updateResult = [];
		deleteResult = [];
	});

	describe('createCategory', () => {
		it('inserts a category and returns it', async () => {
			const cat = { id: 'cat-1', name: 'Guitars', displayOrder: 0, pricingTier: 'major' };
			insertResult = [cat];

			const result = await createCategory({ name: 'Guitars', pricingTier: 'major' });
			expect(result).toEqual(cat);
		});
	});

	describe('updateCategory', () => {
		it('returns updated category', async () => {
			const cat = { id: 'cat-1', name: 'Amps', pricingTier: 'major' };
			updateResult = [cat];

			const result = await updateCategory('cat-1', { name: 'Amps' });
			expect(result).toEqual(cat);
		});

		it('throws CategoryNotFoundError when id does not exist', async () => {
			updateResult = [];
			await expect(updateCategory('bad-id', { name: 'X' })).rejects.toThrow(CategoryNotFoundError);
		});
	});

	describe('deleteCategory', () => {
		it('throws CategoryHasEquipmentError when equipment is assigned', async () => {
			selectResult = [{ id: 'eq-1' }];
			await expect(deleteCategory('cat-1')).rejects.toThrow(CategoryHasEquipmentError);
		});

		it('throws CategoryNotFoundError when id does not exist', async () => {
			selectResult = [];
			deleteResult = [];
			await expect(deleteCategory('bad-id')).rejects.toThrow(CategoryNotFoundError);
		});

		it('deletes category when no equipment assigned', async () => {
			selectResult = [];
			const cat = { id: 'cat-1', name: 'Empty' };
			deleteResult = [cat];

			const result = await deleteCategory('cat-1');
			expect(result).toEqual(cat);
		});
	});

	describe('createEquipment', () => {
		it('inserts equipment with defaults', async () => {
			const item = {
				id: 'eq-1',
				name: 'SM58',
				categoryId: 'cat-1',
				totalQuantity: 1,
				outOfOrderQuantity: 0,
				condition: 'good',
				status: 'available'
			};
			insertResult = [item];

			const result = await createEquipment({
				name: 'SM58',
				categoryId: 'cat-1',
				condition: 'good'
			});
			expect(result).toEqual(item);
		});
	});

	describe('updateEquipment', () => {
		it('throws EquipmentNotFoundError when no match', async () => {
			updateResult = [];
			await expect(updateEquipment('bad-id', { name: 'X' })).rejects.toThrow(
				EquipmentNotFoundError
			);
		});
	});

	describe('softDeleteEquipment', () => {
		it('sets deletedAt on the equipment row', async () => {
			const item = { id: 'eq-1', deletedAt: new Date() };
			updateResult = [item];

			const result = await softDeleteEquipment('eq-1');
			expect(result.deletedAt).toBeDefined();
		});

		it('throws EquipmentNotFoundError when not found', async () => {
			updateResult = [];
			await expect(softDeleteEquipment('bad-id')).rejects.toThrow(EquipmentNotFoundError);
		});
	});

	describe('restoreEquipment', () => {
		it('clears deletedAt', async () => {
			const item = { id: 'eq-1', deletedAt: null };
			updateResult = [item];

			const result = await restoreEquipment('eq-1');
			expect(result.deletedAt).toBeNull();
		});

		it('throws EquipmentNotFoundError when not found', async () => {
			updateResult = [];
			await expect(restoreEquipment('bad-id')).rejects.toThrow(EquipmentNotFoundError);
		});
	});
});
