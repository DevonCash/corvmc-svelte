# Standardization rollout — progress checklist

Tracks execution of [standardization-audit.md](../reports/standardization-audit.md).
Survives between sessions. Update the status column as tranches land.

**Decision made 2026-08-16:** timezone converges on **`DEFAULT_TIMEZONE` (venue time)**.
This is a location-based application — a 7pm booking is 7pm at the venue regardless of
where the member is standing. `DateTimeRange`/`Duration` are therefore unblocked.

## Status

**Re-prioritised 2026-08-16** after re-verifying the audit's three "correctness issues" — all
three were overstated (see the revision note in the audit). Timezone convergence moves to #1
because it is the only genuinely user-visible defect of the four.

| #   | Tranche                                                                          | Status | Commit  |
| --- | -------------------------------------------------------------------------------- | ------ | ------- |
| 1   | **C4** Timezone → `DEFAULT_TIMEZONE` everywhere; then `DateTimeRange`/`Duration` | ✅     | cdb94b2 |
| 2   | `DefinitionList` — 11 byte-identical copies / 9 files                            | ✅     | (next)  |
| 3   | `Money` + route 3 fee formulas through `$lib/finance/fees` (C3, drift risk)      | ⬜     |         |
| 4   | **C2** `mapDomainError` in remaining 22 files; 11 fall-through classes           | ⬜     |         |
| 5   | Filter schemas — converge `page`, and fix the real `status` validation gap (C1)  | ⬜     |         |
| 6   | Centralize validation limits (~110 magic numbers)                                | ⬜     |         |
| 7   | `StatusBadge` maps → plain `.ts`; one home for enum definitions                  | ⬜     |         |
| 8   | Sweep raw `locals.user` guards; delete dead `requireStaffOrOwner`, dup helpers   | ⬜     |         |
| 9   | `RowCard`, `ShareButton`, `initials`→`format.ts`, `StatCard` size prop           | ⬜     |         |
| 10  | Pattern-drift sweep (page-editor, epk, staff/settings, staff/events/[id])        | ⬜     |         |
| 11  | `RecordHero` / `PersonChip` — need design calls                                  | ⬜     |         |

Legend: ⬜ not started · 🔵 in progress · ✅ done · ⏸️ blocked

## Ground rules

- One tranche per commit. No co-author lines.
- Regression test **before** the fix for anything behavioural (C1, C2, C3, timezone).
- Run the minimum tests needed while working; full suite before each commit.
- Clean baseline is ~23 failed _files_ / **0 failed tests** — failures in that shape are
  pre-existing module-resolution noise, not regressions.

## Notes / decisions log

- (2026-08-16) Timezone: venue time (`DEFAULT_TIMEZONE`) everywhere. See above.
- (2026-08-16) Audit C1/C2/C3 all overstated on first pass; corrected in place before any code
  changed. C1 is not a bug (callers coerce); C2 is 11 classes not ~32; C3 is drift risk only.
  Lesson: verify a finding immediately before acting on it, not just when writing it down.
- (2026-08-16) Two dead helpers found: `parsePagination()` (`paginate.ts:14`) and
  `requireStaffOrOwner()` (`authorization.ts:146`) — both zero call sites. Decide adopt-or-delete.
- Clean server-project baseline confirmed 2026-08-16: **154 files / 1903 tests / 0 failures**.
- (2026-08-16) Tranche 1 landed. Note for anyone extending `format.ts`: format the instant
  _directly_ in the named zone. Converting to a local `Date` first and formatting that shifts the
  hour whenever the venue wall-clock falls in the viewer's DST gap — silently, with no error.
- (2026-08-16) `format.spec.ts` forces `TZ=UTC` and asserts the ambient zone differs from the
  venue. Do not remove that guard: this repo's primary dev machine is set to
  `America/Los_Angeles`, so without it every assertion passes for the wrong reason.
- (2026-08-16) `DateTimeRange`/`Duration` are still unbuilt — the timezone blocker is cleared,
  but the 5 competing duration labels still need one canonical shape chosen.
- (2026-08-16) Tranche 2 landed. `member/equipment/loans/+page.svelte` deliberately NOT migrated:
  its `<dt>`s hold icons + tooltips + responsive spans, which `Fact`'s string `label` doesn't take.
  Adding a snippet-label escape hatch for one consumer would over-fit the component.
- (2026-08-16) Watch for `class:` directives when converting an element to a component — they do
  not forward to the inner element. Two silent styling regressions were caught this way
  (`staff/equipment/[id]`, `staff/equipment/loans/[id]`); both became `class={cond ? 'x' : ''}`.
- (2026-08-16) Tranche 3 landed **without** the `<Money>` component the audit proposed. The call
  sites render as `${cents(x)}` inside spans mixed with other text; a component would have added
  ceremony without removing anything. Consolidating on the existing `formatCents`/`formatDollars`
  deleted every duplicate on its own. Revisit only if a real need for `perUnit`/`zeroLabel` appears.
- (2026-08-16) C2 corrected a second time. 10 of the 11 "fall-through" classes are handled inline
  in remote catch blocks; only `UserHasPublishedListingsError` actually 500'd. Fixed + tested.
  **Pattern to note: every severity claim in the original audit was inflated because it inferred
  behaviour from structure instead of tracing call paths.** Trace before believing the next one.
- Remaining in tranche 4: migrate the 22 remote files onto `mapDomainError` so a new error class
  no longer has to be remembered in a hand-written ladder. That is the mechanism that hid this bug.

## Open decisions

- **`InsufficientCreditsError`: 409 or 422?** `mapDomainError` says 422 (business-rule violation);
  `users.remote.ts:367` has always answered 409. The last inline ladder in the remote layer is
  parked on this. Collapsing it would silently change that endpoint's contract, so it is left
  visible with a comment. Pick one, then delete both the comment and the ladder.
- **Two dead helpers, adopt or delete:** `parsePagination()` (`db/paginate.ts:14`) and
  `requireStaffOrOwner()` (`authorization.ts:146`), both zero call sites. `requireStaffOrOwner`
  duplicates a check four places hand-roll, so adopting it is probably right.

## Notes / decisions log (cont.)

- (2026-08-16) Tranche 5: migrating 10 error classes onto `DomainError` created a **circular
  import** — `errors.ts` imports every service to build its ladder, and the services now import
  the base back. `extends` runs at module-init, so 16 test files died with
  `Class extends value undefined`. **`svelte-check` passed throughout**: it is an evaluation-order
  fault, not a type fault. Fixed by moving the base into the dependency-free leaf module
  `src/lib/server/domain-error.ts`. **Keep that file importing nothing.**
- (2026-08-16) `band-address.remote.ts` deliberately keeps its inline handling: `SlugUnavailableError`
  resolves to `invalid(issue.newSlug(...))`, a form-field issue, not an HTTP error. `mapDomainError`
  cannot express that, and a blanket migration would have broken that form's validation UX.
- (2026-08-16) When a mock stands in for a class whose _behaviour_ depends on a base (here
  `httpStatus`), the mock has to extend the real base. `users.remote.spec.ts` used bare
  `extends Error` stand-ins, which silently stopped exercising the mapping once it went generic.
