# Component testing coverage checklist

Incremental coverage for isolated component tests. See
[component-testing.md](./component-testing.md) for the how. Pure components get a
`.stories.svelte`; coupled components get a `.svelte.spec.ts`.

## Harness (done)

- [x] `src/lib/test/fixtures.ts` — `fakeUser`, `fakeBand`
- [x] `src/lib/test/mocks.ts` — `fakeField`, `fakeForm`
- [x] `pnpm test:components` script
- [x] Docs: `component-testing.md` + pointer from `ui-patterns.md`
- [x] Exemplar story: `EmptyState.stories.svelte`
- [x] Exemplar spec: `AccountDropdown.svelte.spec.ts`

## Pure components — stories

- [x] EmptyState
- [ ] Button
- [ ] Badge
- [ ] Avatar
- [ ] Alert
- [ ] PageHeader
- [ ] InfoCard
- [ ] Modal
- [ ] FormField (has a spec; add a story for the gallery)

## Coupled components — specs

- [x] AccountDropdown
- [ ] NotificationBell
- [ ] TabBar
- [ ] MemberLink
- [ ] actions/CancelReservationAction (use `fakeForm`)
- [ ] actions/AdjustCreditsAction
- [ ] actions/CreateBandAction
- [ ] remaining `actions/*` (15 more)
