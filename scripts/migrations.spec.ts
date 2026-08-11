import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { basename, dirname } from 'node:path';

/**
 * Guards the shape of the SQL we hand to Cloudflare D1.
 *
 * `drizzle-kit migrate` (the d1-http driver used by `pnpm ci:migrate`) splits a
 * migration on `--> statement-breakpoint` and POSTs each chunk to D1 as one
 * statement. A chunk containing only comments has no statement in it, so D1
 * rejects the whole migration with `7500: SQL code did not contain a statement`
 * — which is what broke the production deploy when a hand-written migration put
 * breakpoints between its explanatory comments.
 *
 * Comments are fine; they just have to travel with the statement they describe.
 */
const BREAKPOINT = '--> statement-breakpoint';

function executableLines(chunk: string): string[] {
	return chunk
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith('--'));
}

describe('D1 migrations', () => {
	const files = globSync('migrations/*/migration.sql').sort();

	it('finds migration files to check', () => {
		expect(files.length).toBeGreaterThan(0);
	});

	it.each(files)('%s splits into chunks that each contain a statement', (file) => {
		const chunks = readFileSync(file, 'utf8').split(BREAKPOINT);

		const empty = chunks
			.map((chunk, index) => ({ index, chunk }))
			.filter(({ chunk }) => executableLines(chunk).length === 0)
			.map(({ index, chunk }) => `chunk ${index}: ${chunk.trim().split('\n')[0] ?? '(empty)'}`);

		expect(
			empty,
			`${basename(dirname(file))} has comment-only chunks; D1 rejects these with 7500. ` +
				`Move the comment onto the statement it describes instead of separating it ` +
				`with its own ${BREAKPOINT}.`
		).toEqual([]);
	});
});
