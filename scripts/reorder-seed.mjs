// Reorder a data-only D1 export so INSERTs run parent-first (FK-safe).
import { readFileSync, writeFileSync } from 'fs';

const order = [
	// roots → leaves
	'user', 'recurring_series',
	'band', 'reservation', 'equipment_category',
	'event', 'campaign', 'audience', 'equipment', 'inbox_thread',
	'help_categories', 'subscriber', 'roles', 'permissions',
	// independents (no FKs)
	'closure', 'inbox_channel_config', 'product_config', 'verification',
	// leaves
	'user_genre', 'user_instrument', 'model_has_permissions', 'model_has_roles',
	'role_has_permissions', 'band_genre', 'campaign_audience', 'session',
	'audience_member', 'equipment_loan', 'notification_preference', 'notification',
	'account', 'band_member', 'payment_cache', 'ticket', 'platform_invite',
	'credit_transaction', 'help_articles', 'band_media', 'band_page_config',
	'inbox_message', 'inbox_note'
];

const lines = readFileSync('d1-seed.sql', 'utf8').split('\n');
const byTable = new Map();
const re = /^INSERT INTO "([^"]+)"/;
for (const line of lines) {
	const m = line.match(re);
	if (!m) continue;
	if (!byTable.has(m[1])) byTable.set(m[1], []);
	byTable.get(m[1]).push(line);
}

// sanity: report any application tables in the dump not in our order list.
// Internal SQLite tables (sqlite_sequence) are skipped — they're auto-managed.
const missing = [...byTable.keys()].filter((t) => !order.includes(t) && !t.startsWith('sqlite_'));
if (missing.length) {
	console.error('Application tables in dump not in order list:', missing.join(', '));
	process.exit(1);
}

const out = ['PRAGMA defer_foreign_keys=TRUE;'];
let total = 0;
for (const t of order) {
	const rows = byTable.get(t);
	if (!rows) continue;
	out.push(...rows);
	total += rows.length;
}
writeFileSync('d1-seed-ordered.sql', out.join('\n') + '\n');
console.log(`Reordered ${total} inserts across ${[...byTable.keys()].length} tables → d1-seed-ordered.sql`);
