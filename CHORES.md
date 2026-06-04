# Chores

Low-priority cleanup and tech-debt items. Not blocking, but worth doing.

## Open

- **Remove orphaned SvelteKit tracing/instrumentation flags from `svelte.config.js`.**
  `kit.experimental.tracing.server: true` and `kit.experimental.instrumentation.server: true`
  were added in the Jun 3 Sentry integration commit (`769a6f5`) alongside a
  `src/instrumentation.server.ts` file. The follow-up `6a94b27` removed that
  instrumentation file and switched to `Sentry.initCloudflareSentryHandle`, but
  left the two flags behind. There is now no instrumentation file and
  `@opentelemetry/api` is not installed. The build/worker tolerate it today, but
  the flags are dead config — remove both (keep `remoteFunctions: true`).
