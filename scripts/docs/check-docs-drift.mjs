/**
 * Deterministic docs-drift detector. No LLM, no dependencies — runs with bare `node`.
 *
 * Two kinds of signal:
 *   1. Help-content INTEGRITY (hard errors): frontmatter parses, slugs are unique,
 *      every seeded `static` slug has a backing file, and every internal
 *      `/member/help/<slug>` link resolves. Mirrors scripts/sync-help-articles.ts.
 *   2. Route DRIFT (work signal): routes added/removed vs the committed snapshot
 *      at docs/manual/route-inventory.json (regenerate with `docs:routes`).
 *
 * Usage:
 *   node scripts/docs/check-docs-drift.mjs            # full check (nightly gate)
 *   node scripts/docs/check-docs-drift.mjs --ci       # PR gate: fail only on integrity errors
 *   node scripts/docs/check-docs-drift.mjs --json      # print machine report only
 *
 * Always writes docs-drift-report.json. Exit codes:
 *   0  nothing actionable
 *   1  findings present (integrity errors and/or route drift)  [default mode]
 *   2  script error
 * In --ci mode, exits 1 only when there are integrity errors (route drift is informational).
 */
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { listRoutes, readSnapshot, SNAPSHOT_PATH } from './route-inventory.mjs';

const HELP_DIR = 'src/content/help';
const SEED_FILE = 'scripts/seed-dev.ts';
const REPORT_PATH = 'docs-drift-report.json';
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

function walk(dir) {
	const out = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) out.push(...walk(full));
		else if (entry.endsWith('.md')) out.push(full);
	}
	return out;
}

/** Parse YAML frontmatter exactly like scripts/sync-help-articles.ts. */
function parseFrontmatter(content) {
	const m = content.match(FRONTMATTER_RE);
	if (!m) throw new Error('Missing frontmatter');
	const meta = {};
	for (const line of m[1].split('\n')) {
		const [k, ...rest] = line.split(':');
		if (k && rest.length) {
			const v = rest.join(':').trim();
			meta[k.trim()] = /^\d+$/.test(v) ? parseInt(v) : v;
		}
	}
	return { meta, body: m[2].trim() };
}

/** Slugs seeded as source='static' in seed-dev.ts — sync deletes static rows with no file. */
function seededStaticSlugs() {
	if (!existsSync(SEED_FILE)) return [];
	const src = readFileSync(SEED_FILE, 'utf-8');
	// Anchor to the help-article array so we skip imports and the category list above it.
	const start = src.indexOf('const articles');
	const region = start === -1 ? src : src.slice(start);
	// Each article object declares `slug:` before its `source:`. Associate every
	// `source: 'static'` with its nearest PRECEDING slug (its own object) — robust to
	// long `content:` strings and to interleaved dynamic articles.
	const slugMatches = [...region.matchAll(/slug:\s*'([^']+)'/g)].map((m) => ({
		slug: m[1],
		idx: m.index
	}));
	const slugs = [];
	for (const m of region.matchAll(/source:\s*'static'/g)) {
		let chosen = null;
		for (const s of slugMatches) {
			if (s.idx < m.index) chosen = s.slug;
			else break;
		}
		if (chosen) slugs.push(chosen);
	}
	return [...new Set(slugs)];
}

function checkHelpContent() {
	const errors = [];
	const slugToFile = new Map();
	const links = []; // [targetSlug, fromSlug, fromFile]

	if (!existsSync(HELP_DIR)) return { errors: [`missing ${HELP_DIR}`], slugs: new Set() };

	for (const file of walk(HELP_DIR)) {
		const rel = relative('.', file);
		let parsed;
		try {
			parsed = parseFrontmatter(readFileSync(file, 'utf-8'));
		} catch (e) {
			errors.push(`${rel}: ${e.message}`);
			continue;
		}
		const { meta, body } = parsed;
		for (const req of ['title', 'slug', 'category']) {
			if (!meta[req]) errors.push(`${rel}: missing frontmatter field "${req}"`);
		}
		if (!body) errors.push(`${rel}: empty body`);
		if (meta.summary && String(meta.summary).length > 500)
			errors.push(`${rel}: summary exceeds 500 chars`);
		if (meta.title && String(meta.title).length > 255)
			errors.push(`${rel}: title exceeds 255 chars`);
		if (meta.slug) {
			if (slugToFile.has(meta.slug))
				errors.push(`duplicate slug "${meta.slug}" (${rel} and ${slugToFile.get(meta.slug)})`);
			else slugToFile.set(meta.slug, rel);
		}
		for (const mm of body.matchAll(/\/member\/help\/([a-z0-9-]+)/g))
			links.push([mm[1], meta.slug, rel]);
	}

	const slugs = new Set(slugToFile.keys());
	for (const seeded of seededStaticSlugs()) {
		if (!slugs.has(seeded))
			errors.push(`seeded static slug "${seeded}" has no backing file (help:sync would delete it)`);
	}
	for (const [target, , fromFile] of links) {
		if (!slugs.has(target)) errors.push(`${fromFile}: broken internal link /member/help/${target}`);
	}
	return { errors, slugs };
}

function checkRouteDrift() {
	const current = listRoutes();
	const snapshot = readSnapshot();
	if (snapshot === null) {
		return {
			snapshotMissing: true,
			added: current.map((r) => r.route),
			removed: [],
			current
		};
	}
	const curSet = new Set(current.map((r) => r.route));
	const snapSet = new Set(snapshot.map((r) => r.route));
	const added = current.filter((r) => !snapSet.has(r.route));
	const removed = snapshot.filter((r) => !curSet.has(r.route));
	return { snapshotMissing: false, added, removed, current };
}

function main() {
	const ci = process.argv.includes('--ci');
	const jsonOnly = process.argv.includes('--json');

	const help = checkHelpContent();
	const routes = checkRouteDrift();

	const report = {
		integrityErrors: help.errors,
		routeAdded: routes.added.map((r) => (typeof r === 'string' ? r : r.route)),
		routeRemoved: routes.removed.map((r) => (typeof r === 'string' ? r : r.route)),
		snapshotMissing: routes.snapshotMissing,
		articleCount: help.slugs.size
	};
	writeFileSync(REPORT_PATH, JSON.stringify(report, null, '\t') + '\n');

	if (!jsonOnly) {
		console.log('— Docs drift check —');
		console.log(`Help articles: ${report.articleCount}`);
		if (report.integrityErrors.length) {
			console.log(`\nIntegrity errors (${report.integrityErrors.length}):`);
			for (const e of report.integrityErrors) console.log(`  ✗ ${e}`);
		} else {
			console.log('Integrity: OK');
		}
		if (report.snapshotMissing) {
			console.log(
				`\nRoute snapshot ${SNAPSHOT_PATH} missing — run \`pnpm docs:routes\` to create it.`
			);
		} else {
			console.log(`\nRoute drift: +${report.routeAdded.length} / -${report.routeRemoved.length}`);
			for (const r of report.routeAdded) console.log(`  + ${r} (no doc snapshot yet)`);
			for (const r of report.routeRemoved) console.log(`  - ${r} (route gone; docs may be stale)`);
		}
		console.log(`\nReport written to ${REPORT_PATH}`);
	} else {
		console.log(JSON.stringify(report, null, '\t'));
	}

	const hasIntegrity = report.integrityErrors.length > 0;
	const hasDrift =
		report.routeAdded.length > 0 || report.routeRemoved.length > 0 || report.snapshotMissing;
	if (ci) process.exit(hasIntegrity ? 1 : 0);
	process.exit(hasIntegrity || hasDrift ? 1 : 0);
}

try {
	main();
} catch (e) {
	console.error('check-docs-drift failed:', e.message);
	process.exit(2);
}
