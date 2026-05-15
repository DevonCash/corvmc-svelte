import { sqliteTable, text, integer, index, unique, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { timestamp } from './columns';
import { user } from './auth';

// ---------------------------------------------------------------------------
// Roles & permissions (translated from spatie/laravel-permission)
// ---------------------------------------------------------------------------

export const permission = sqliteTable(
	'permissions',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		name: text('name').notNull(),
		guardName: text('guard_name').notNull().default('web'),
		createdAt: timestamp('created_at').default(sql`(current_timestamp)`),
		updatedAt: timestamp('updated_at').default(sql`(current_timestamp)`)
	},
	(t) => [unique('permissions_name_guard_unique').on(t.name, t.guardName)]
);

export const role = sqliteTable(
	'roles',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		name: text('name').notNull(),
		guardName: text('guard_name').notNull().default('web'),
		createdAt: timestamp('created_at').default(sql`(current_timestamp)`),
		updatedAt: timestamp('updated_at').default(sql`(current_timestamp)`)
	},
	(t) => [unique('roles_name_guard_unique').on(t.name, t.guardName)]
);

export const modelHasPermission = sqliteTable(
	'model_has_permissions',
	{
		permissionId: integer('permission_id')
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

export const modelHasRole = sqliteTable(
	'model_has_roles',
	{
		roleId: integer('role_id')
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

export const roleHasPermission = sqliteTable(
	'role_has_permissions',
	{
		permissionId: integer('permission_id')
			.notNull()
			.references(() => permission.id, { onDelete: 'cascade' }),
		roleId: integer('role_id')
			.notNull()
			.references(() => role.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.permissionId, t.roleId] })]
);
