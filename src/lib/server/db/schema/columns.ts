import { customType } from 'drizzle-orm/sqlite-core';
import type { z } from 'zod';

export type Serialized<T> = {
	[K in keyof T]: T[K] extends Date
		? string
		: T[K] extends Date | null
			? string | null
			: T[K];
};

export const timestamp = customType<{
	data: Date;
	driverData: string;
}>({
	dataType() {
		return 'text';
	},
	fromDriver(value: string): Date {
		return new Date(value);
	},
	toDriver(value: Date): string {
		return value instanceof Date ? value.toISOString() : String(value);
	}
});

export const uuid = customType<{
	data: string;
	driverData: string;
}>({
	dataType() {
		return 'text';
	},
	fromDriver(value: string): string {
		return value;
	},
	toDriver(value: string): string {
		return value;
	}
});

export function zodJson<T extends z.ZodTypeAny>(schema: T) {
	return customType<{
		data: z.infer<T>;
		driverData: string;
	}>({
		dataType() {
			return 'text';
		},
		fromDriver(value: string): z.infer<T> {
			return schema.parse(typeof value === 'string' ? JSON.parse(value) : value);
		},
		toDriver(value: z.infer<T>): string {
			return JSON.stringify(schema.parse(value));
		}
	});
}
