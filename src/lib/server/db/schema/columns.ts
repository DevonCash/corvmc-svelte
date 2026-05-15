import { customType } from 'drizzle-orm/sqlite-core';

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
