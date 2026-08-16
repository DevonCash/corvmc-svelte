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

| #   | Tranche                                                                          | Status | Commit |
| --- | -------------------------------------------------------------------------------- | ------ | ------ |
| 1   | **C4** Timezone → `DEFAULT_TIMEZONE` everywhere; then `DateTimeRange`/`Duration` | ⬜     |        |
| 2   | `DefinitionList` — 11 byte-identical copies / 9 files                            | ⬜     |        |
| 3   | `Money` + route 3 fee formulas through `$lib/finance/fees` (C3, drift risk)      | ⬜     |        |
| 4   | **C2** `mapDomainError` in remaining 22 files; 11 fall-through classes           | ⬜     |        |
| 5   | Filter schemas — converge `page`, and fix the real `status` validation gap (C1)  | ⬜     |        |
| 6   | Centralize validation limits (~110 magic numbers)                                | ⬜     |        |
| 7   | `StatusBadge` maps → plain `.ts`; one home for enum definitions                  | ⬜     |        |
| 8   | Sweep raw `locals.user` guards; delete dead `requireStaffOrOwner`, dup helpers   | ⬜     |        |
| 9   | `RowCard`, `ShareButton`, `initials`→`format.ts`, `StatCard` size prop           | ⬜     |        |
| 10  | Pattern-drift sweep (page-editor, epk, staff/settings, staff/events/[id])        | ⬜     |        |
| 11  | `RecordHero` / `PersonChip` — need design calls                                  | ⬜     |        |

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
