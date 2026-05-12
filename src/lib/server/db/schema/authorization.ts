import {
	pgTable,
	text,
	bigserial,
	timestamp,
	primaryKey,
	index,
	unique,
	bigint
} from 'drizzle-orm/pg-core';
import { user } from './auth';

// ---------------------------------------------------------------------------
// Roles & permissions (translated from spatie/laravel-permission)
// ---------------------------------------------------------------------------
// Simplified from Laravel's polymorphic morph pattern: since only users have
// roles/permissions here, pivot tables use a direct text FK to the user table
// instead of model_type + model_id.
// ---------------------------------------------------------------------------

export const permission = pgTable(
	'permissions',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		name: text('name').notNull(),
		guardName: text('guard_name').notNull().default('web'),
		createdAt: timestamp('created_at').defaultNow(),
		updatedAt: timestamp('updated_at').defaultNow()
	},
	(t) => [unique('permissions_name_guard_unique').on(t.name, t.guardName)]
);

export const role = pgTable(
	'roles',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		name: text('name').notNull(),
		guardName: text('guard_name').notNull().default('web'),
		createdAt: timestamp('created_at').defaultNow(),
		updatedAt: timestamp('updated_at').defaultNow()
	},
	(t) => [unique('roles_name_guard_unique').on(t.name, t.guardName)]
);

export const modelHasPermission = pgTable(
	'model_has_permissions',
	{
		permissionId: bigint('permission_id', { mode: 'number' })
			.notNull()
			.references(() => permission.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' })
	},
	(t) => [
		primaryKey({ columns: [t.permissionId, t.userId] }),
		index('model_has_permissions_user_idx').on(t.userId)
	]
);

export const modelHasRole = pgTable(
	'model_has_roles',
	{
		roleId: bigint('role_id', { mode: 'number' })
			.notNull()
			.references(() => role.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' })
	},
	(t) => [
		primaryKey({ columns: [t.roleId, t.userId] }),
		index('model_has_roles_user_idx').on(t.userId)
	]
);

export const roleHasPermission = pgTable(
	'role_has_permissions',
	{
		permissionId: bigint('permission_id', { mode: 'number' })
			.notNull()
			.references(() => permission.id, { onDelete: 'cascade' }),
		roleId: bigint('role_id', { mode: 'number' })
			.notNull()
			.references(() => role.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.permissionId, t.roleId] })]
);
