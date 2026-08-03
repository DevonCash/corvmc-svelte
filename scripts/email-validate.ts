/**
 * Validate every template against Postmark's real Mustachio engine.
 *
 * Run: pnpm email:validate
 *
 * Reads POSTMARK_SERVER_TOKEN from .env (or the environment, which wins).
 *
 * `validateTemplate` renders without sending — it reports syntax errors and
 * any model field the template references but the fixture does not supply.
 * This is the authoritative check; the local Handlebars renderer used by
 * `pnpm email:preview` is only an approximation.
 *
 * Run this before every `pnpm email:push`.
 */
import 'dotenv/config';
import { ServerClient } from 'postmark';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURES } from '../src/lib/server/notification/email/fixtures';
import { readMeta } from '../src/lib/server/notification/email/render-preview';

const token = process.env.POSTMARK_SERVER_TOKEN;
if (!token) {
	console.error(
		'POSTMARK_SERVER_TOKEN is not set.\n' +
			'Add it to .env, or pass it inline:\n' +
			'  POSTMARK_SERVER_TOKEN=<token> pnpm email:validate'
	);
	process.exit(1);
}

const client = new ServerClient(token);
const root = 'postmark/templates';
let failed = 0;

for (const fixture of FIXTURES) {
	const meta = readMeta(fixture.alias);
	const dir = join(root, fixture.alias);
	const layoutDir = meta.LayoutTemplate ? join(root, '_layouts', meta.LayoutTemplate) : null;

	const result = await client.validateTemplate({
		Subject: meta.Subject ?? '',
		HtmlBody: readFileSync(join(dir, 'content.html'), 'utf8'),
		TextBody: readFileSync(join(dir, 'content.txt'), 'utf8'),
		TemplateType: 'Standard',
		LayoutTemplate: layoutDir ? readFileSync(join(layoutDir, 'content.html'), 'utf8') : undefined,
		TestRenderModel: fixture.model
	});

	const parts = [
		['Subject', result.Subject],
		['HtmlBody', result.HtmlBody],
		['TextBody', result.TextBody]
	] as const;

	const errors = parts.flatMap(([name, part]) =>
		part?.ContentIsValid === false
			? (part.ValidationErrors ?? []).map((e) => `${name}: ${e.Message} (line ${e.Line})`)
			: []
	);

	if (errors.length > 0) {
		failed++;
		console.error(`✗ ${fixture.name} (${fixture.alias})`);
		for (const e of errors) console.error(`    ${e}`);
		continue;
	}

	// Fields the template references but the fixture never supplied — usually a typo.
	const suggested = (result.SuggestedTemplateModel ?? {}) as Record<string, unknown>;
	const unsupplied = Object.keys(suggested).filter((k) => !(k in fixture.model));

	console.log(
		`✓ ${fixture.name} (${fixture.alias})${unsupplied.length ? ` — unsupplied: ${unsupplied.join(', ')}` : ''}`
	);
}

if (failed > 0) {
	console.error(`\n${failed} template(s) failed validation.`);
	process.exit(1);
}
console.log('\nAll templates valid.');
