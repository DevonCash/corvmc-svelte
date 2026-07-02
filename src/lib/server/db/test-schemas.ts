/**
 * Zod schemas mirroring Drizzle tables, used for mock data generation in tests.
 * These are the "shape" definitions that zod4-mock uses to generate realistic
 * fixture data — they are NOT used at runtime.
 */
import { z } from 'zod';

export const UserSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	email: z.email(),
	emailVerified: z.boolean(),
	image: z.string().nullable(),
	pronouns: z.string().nullable(),
	phone: z.string().nullable(),
	settings: z.record(z.string(), z.unknown()).nullable(),
	stripeId: z.string().nullable(),
	pmType: z.string().nullable(),
	pmLastFour: z.string().nullable(),
	deletedAt: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date()
});

export const RoleSchema = z.object({
	id: z.number().int().positive(),
	name: z.string(),
	guardName: z.literal('web'),
	createdAt: z.date(),
	updatedAt: z.date()
});

export const PermissionSchema = z.object({
	id: z.number().int().positive(),
	name: z.string(),
	guardName: z.literal('web'),
	createdAt: z.date(),
	updatedAt: z.date()
});

export const UserHasRoleSchema = z.object({
	roleId: z.number().int().positive(),
	userId: z.uuid()
});

export const UserHasPermissionSchema = z.object({
	permissionId: z.number().int().positive(),
	userId: z.uuid()
});

export type MockUser = z.infer<typeof UserSchema>;
export type MockRole = z.infer<typeof RoleSchema>;
export type MockPermission = z.infer<typeof PermissionSchema>;
