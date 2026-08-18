---
paths:
  - '**/*.test.ts'
  - '**/*.spec.ts'
  - 'e2e/**'
---

# Tests

Three vitest projects in `vite.config.ts`: `client` (chromium, `*.svelte.{test,spec}.ts`),
`server` (node, `vmForks` pool), and `storybook`. `expect.requireAssertions` is on globally, so a
test that asserts nothing fails.

- **Scope the run.** Cost is dominated by per-file module-graph evaluation, not by assertions —
  a targeted path is far cheaper than the suite. Compare warm runs to warm runs.
- A `"timed out in 5000ms"` failure on a cold `.vite` cache is usually an in-test `await import`,
  not flakiness. Hoist the import.
- **Don't merge sibling `.test.ts` and `.spec.ts` files** to share imports. Their preambles are
  fixtures: unioning the `vi.mock` calls silently stubs out the very thing the other file was
  testing for real.
- Test SQL without a database by rendering drizzle fragments through `SQLiteSyncDialect` (see
  `src/lib/server/authorization.spec.ts`). `better-sqlite3` isn't built in CI, so mock only
  `$lib/server/db`.

## e2e

- **Run with `--workers=1` locally.** `playwright.config.ts` sets no worker count, so a many-core
  machine fans out and the suite goes red on contention where CI's narrower runner passes.
  Re-running without `--workers=1` will not fix it.
- D1 setup happens in `e2e/prepare.ts`, before Playwright starts — `pnpm test:e2e` runs it first.
  It builds the suite's own state directory (`.wrangler/e2e-state`, see `e2e/state-dir.ts`), which
  the preview server then holds alone. Seeds go through `withPlatformDb`/`withPlatformEnv`
  (miniflare, prepare only); a read-back from inside a test goes through `readLocalDb`, which
  reads the same SQLite file without starting a second workerd over it.
- Fixtures must reset KV rate-limit counters; they survive between runs, and the failure surfaces
  as unrelated state that nothing in the test ever touched.
- Kill an orphaned `:4173` preview before debugging failures — `reuseExistingServer` will happily
  serve a stale build.
- A whole-suite red run can still be workerd dying on `SQLITE_BUSY_RECOVERY` — but since the state
  directory is the suite's own, that means a second `pnpm test:e2e` is running, not a dev server.
- `playwright.config.ts` spawns `npm run build && npm run preview` for its web server. That is
  fine — it only delegates to `package.json`. Leave it alone.
