/**
 * Turn on the feature flags the e2e suite needs, in the LOCAL KV namespace used
 * by `vite preview`. Flags live in KV (`site-config:feature.*`, see
 * src/lib/server/site-config/site-config-service.ts) and all default to false,
 * so a flagged surface 404s in e2e unless it is enabled here.
 *
 * Run by the Playwright global setup (see playwright.config.ts → globalSetup).
 *
 * Idempotent: writes the same values on every run.
 */
import 'dotenv/config';
import { getPlatformProxy } from 'wrangler';

/** Gates /band/[slug]/subscription, the page editor and /band-site/**. */
export const ENABLED_FLAGS = ['bandPremium'] as const;

export async function seedFeatureFlags(): Promise<void> {
	const { env, dispose } = await getPlatformProxy();
	const kv = (env as { KV: KVNamespace }).KV;

	try {
		for (const flag of ENABLED_FLAGS) {
			// Same encoding as putJson() in src/lib/server/kv.ts — the app reads
			// these back with get(key, 'json').
			await kv.put(`site-config:feature.${flag}`, JSON.stringify(true));
		}
	} finally {
		await dispose();
	}
}
