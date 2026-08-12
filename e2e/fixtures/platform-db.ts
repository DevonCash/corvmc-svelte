/**
 * Shared access to the local D1 for e2e fixtures and read-back assertions.
 *
 * Every fixture that wants to look at the database opens its own
 * `getPlatformProxy()`, which starts a *second* miniflare over the same
 * `.wrangler/state` directory the preview server is already using. Two
 * processes over one state dir collide from time to time — SQLite hands back
 * `SQLITE_BUSY` / `SQLITE_BUSY_SNAPSHOT`, which D1 surfaces as an opaque
 * "internal error" and workerd logs as `SENTRY_DO SQLite failed`. It shows up
 * most often on a read taken immediately after the UI wrote something, while
 * the server still has work in flight.
 *
 * That contention is a property of the local setup, not something any test is
 * asserting, so retry it rather than failing the run.
 */
import 'dotenv/config';
import { getPlatformProxy } from 'wrangler';
import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

/** Transient lock contention, as opposed to a genuine query or schema error. */
function isLockContention(err: unknown): boolean {
	// D1 flattens the underlying SQLite failure into a message, and the useful
	// text is often only on a nested `cause`, so walk the chain.
	for (let e: unknown = err, depth = 0; e && depth < 5; depth++) {
		const message = e instanceof Error ? `${e.message}` : String(e);
		if (/SQLITE_BUSY|database is locked|Failed to parse body as JSON|internal error/i.test(message))
			return true;
		e = e instanceof Error ? (e.cause ?? null) : null;
	}
	return false;
}

const MAX_ATTEMPTS = 5;

/**
 * Run `fn` against the local D1 (and KV), retrying transient lock contention
 * with a widening backoff. A fresh proxy is opened per attempt — the lock can
 * be taken during `getPlatformProxy()` itself, not only by the query.
 */
export async function withPlatformEnv<T>(
	fn: (ctx: { db: DrizzleD1Database; env: Record<string, unknown> }) => Promise<T>
): Promise<T> {
	let lastError: unknown;

	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		let dispose: (() => Promise<void>) | null = null;
		try {
			const proxy = await getPlatformProxy();
			dispose = proxy.dispose;
			const env = proxy.env as Record<string, unknown>;
			return await fn({ db: drizzle((env as { DB: D1Database }).DB), env });
		} catch (err) {
			lastError = err;
			if (!isLockContention(err) || attempt === MAX_ATTEMPTS) throw err;
			// Give the server's in-flight request time to let go of the file.
			await new Promise((r) => setTimeout(r, attempt * 250));
		} finally {
			// Always hand the state directory back, including on the failing attempt
			// — a leaked proxy would keep the lock the retry is waiting on.
			if (dispose) await dispose().catch(() => {});
		}
	}

	throw lastError;
}

/** `withPlatformEnv` for the common case of only needing the database. */
export function withPlatformDb<T>(fn: (db: DrizzleD1Database) => Promise<T>): Promise<T> {
	return withPlatformEnv(({ db }) => fn(db));
}
