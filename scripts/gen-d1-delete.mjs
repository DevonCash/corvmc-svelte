// Emit DELETE statements to clear all application data, child-first (reverse of the
// insert order) so foreign keys are never violated. Schema and __drizzle_migrations are
// left intact. Writes d1-delete.sql for `wrangler d1 execute --remote --file`.
import { writeFileSync } from 'fs';
import { tableOrder } from './d1-table-order.mjs';

const out = [...tableOrder].reverse().map((t) => `DELETE FROM "${t}";`);
writeFileSync('d1-delete.sql', out.join('\n') + '\n');
console.log(`Wrote ${out.length} DELETE statements (child-first) → d1-delete.sql`);
