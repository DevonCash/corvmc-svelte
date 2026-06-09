# Chores

Low-priority cleanup and tech-debt items. Not blocking, but worth doing.

## Open

- **`CreateEventModal` toggles use one-way binding.** In `src/routes/staff/events/CreateEventModal.svelte`, the `ticketingEnabled` and `reserveSpace` toggles pass `value={…}` instead of `bind:value`, so toggling them may not update the local state the conditional panels (`{#if ticketingEnabled}` etc.) depend on. Confirm the panels reveal correctly and switch to `bind:value` if not.
- **Dead membership checkout API routes.** `src/routes/api/me/membership/checkout/+server.ts` and `.../update-amount/+server.ts` parse raw `formData` (`coverFees === 'on'`) but aren't referenced by any UI — the membership page uses the `createSubscription`/`updateAmount` remote forms. Verify they're unused and delete them (only `checkout.spec.ts` references them).
