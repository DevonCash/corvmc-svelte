// Single source of truth for D1 table dependency order (parents → children).
// Used to order data INSERTs (parent-first) and DELETEs (child-first, i.e. reversed),
// because D1 enforces foreign keys and ignores PRAGMA defer_foreign_keys on import.
//
// When the schema gains a table with foreign keys, add it here in dependency order:
// a table must appear AFTER every table it references.
export const tableOrder = [
	// roots → leaves
	'user',
	'recurring_series',
	'band',
	'reservation',
	'equipment_category',
	'event',
	'campaign',
	'audience',
	'equipment',
	'inbox_thread',
	'help_categories',
	'subscriber',
	'roles',
	'permissions',
	// independents (no FKs)
	'closure',
	'inbox_channel_config',
	'product_config',
	'verification',
	// leaves
	'user_genre',
	'user_instrument',
	'model_has_permissions',
	'model_has_roles',
	'role_has_permissions',
	'band_genre',
	'campaign_audience',
	'session',
	'audience_member',
	'equipment_loan',
	'notification_preference',
	'notification',
	'account',
	'band_member',
	'payment_cache',
	'ticket',
	'platform_invite',
	'credit_transaction',
	'help_articles',
	'band_media',
	'band_page_config',
	'inbox_message',
	'inbox_note'
];
