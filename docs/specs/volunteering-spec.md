# Volunteering

The Corvallis Music Collective runs on volunteer labor, and nothing in the app
records it. A prospective volunteer today picks "Volunteer Opportunities" from
the public contact form and lands in the staff inbox; from there it is email and
memory. There is no answer to "who volunteered last quarter and for how long,"
which is exactly the number the board and grant applications ask for.

This module gives that labor a home. Staff define **volunteer roles** — job
types with descriptions, like Sound Engineer or Front Desk. Members read those
descriptions, then **log hours** against a role. Staff work a queue of pending
logs, approving or rejecting each one, and a report rolls the approved hours up
by member, by role, and by month over any date range.

Phase 1 is roles and hour logging: retrospective, member-initiated,
staff-approved. Phase 2 — volunteer opportunities and shifts, member sign-up,
per-event staffing needs — is designed here but **not built**. The Phase 1
schema anticipates it and nothing more.

Approved volunteer hours are a record, not a currency. They do not grant
practice-room credits and they never touch the finance ledger.

The module ships behind a `volunteering` feature flag, default off.

---

## Key concepts

**A volunteer role is a job description, not a permission.** `role` is already
taken in this codebase: `src/lib/server/db/schema/authorization.ts` defines the
auth roles (`admin`, `staff`, `member`, …) that `requireStaff()` and
`primaryRoleFor()` read. A `volunteer_role` row grants nothing. It is a name, a
markdown description of what the job involves, and a display order. The two
never interact.

**Roles are a table, not an enum or a config string.** Staff need to add "Merch
table" without a migration, and the job descriptions are the substance of the
member-facing page — a string list could not carry them. It also gives Phase 2
shifts something to reference, which is the main reason the table exists in
Phase 1 rather than later.

**Retired roles are archived, never deleted out from under history.** Deleting a
role that has hour logs would silently rewrite past reports. The role FK is
`ON DELETE RESTRICT`, and a delete attempt on a role with logs is refused with a
pointer to archive instead. Archiving hides a role from the member submit form
and nowhere else — it stays in staff filters and in every report, because the
work happened.

**Approval is what makes a number reportable.** Every report query filters to
`status = 'approved'`. That is the entire purpose of the review step: a member
can claim anything, and the report has to be defensible to a funder.

**Hours are stored as integer minutes.** No floats, matching the cents-as-integer
posture elsewhere in the app. The UI accepts quarter-hours and renders
`formatVolunteerHours()`; the database stores 90, not 1.5.

**Approved hours grant nothing.** There is a test asserting that approving an
hour log writes no `credit_transaction` row. Sweat-equity-for-practice-time is a
plausible future feature and a deliberate non-goal today; the test exists so the
decision is not quietly reversed.

---

## Domain model

### Volunteer role

A job type members can volunteer for. Staff-managed.

```
volunteer_role
  id             uuid pk
  name           text unique        — "Sound Engineer"
  description    text?              — the job description, markdown
  displayOrder   integer            — sort order in pickers and reports
  isActive       boolean            — false = archived; hidden from the submit form only
  createdAt      timestamp
  updatedAt      timestamp
```

### Hour log

One member's claim of time worked in one role on one day.

```
volunteer_hour_log
  id                uuid pk
  userId            uuid fk → user            cascade
  volunteerRoleId   uuid fk → volunteer_role  restrict
  shiftId           text?                     — Phase 2 hook; always null today
  workedOn          timestamp                 — calendar date, anchored at noon club time
  minutes           integer                   — 1..720, check-constrained 1..1440
  description       text                      — what the member actually did
  status            text                      — pending | approved | rejected
  reviewedByUserId  uuid? fk → user           set null
  reviewedAt        timestamp?
  reviewNotes       text?                     — required on reject
  createdAt         timestamp
  updatedAt         timestamp
```

**`workedOn` is anchored at noon club time**, built with
`buildDateInTz(dateStr, '12:00', DEFAULT_TIMEZONE)`. It is conceptually a
calendar date, but this codebase has no text-date columns, so it is a timestamp
like every other date.

Noon rather than midnight because the report buckets months with
`strftime('%Y-%m', worked_on, 'unixepoch')`, which reads the instant in UTC. Noon
local lands mid-day in UTC at any offset from −11 to +11, so the UTC month always
matches the local date. Midnight local would in fact work for the Americas
(00:00 PT is 07:00 UTC, same day) — but it breaks the moment the anchor is a
UTC-ahead zone, where midnight local is the _previous_ UTC day and every
1st-of-the-month log buckets into the prior month. Noon costs nothing and removes
the class of bug. `hour-log-service.spec.ts` pins it.

**`shiftId` is a bare text column, not a foreign key.** The Phase 2 table does
not exist, and Phase 1 must not create an empty one just to satisfy a
constraint. Adding the real FK in Phase 2 forces a SQLite table rebuild, but
`volunteer_hour_log` has no FK children, so the D1 cascade hazard documented in
`docs/development/conventions.md` does not apply and `pnpm db:generate`'s
rebuild script handles it unattended.

---

## Status lifecycle

```
              ┌────────► approved
              │
   pending ───┤
     │        │
     │        └────────► rejected
     ▼
  (deleted)
```

- **pending** — submitted, awaiting staff review. The only status the member can
  edit or withdraw, and the only one staff can act on.
- **approved** — counted in every report. Terminal.
- **rejected** — carries `reviewNotes` explaining why, so the member can correct
  and resubmit. Excluded from all reports. Terminal.

**Withdrawal is a hard delete**, not a fourth status. A member may delete their
own `pending` log; nothing downstream references an hour log, so there is no
audit trail to preserve, and a `withdrawn` status would be a value no report ever
selects. Once reviewed, a log is immutable to the member.

Re-review is not supported: approve and reject both require `status = 'pending'`
and throw `HourLogAlreadyReviewedError` otherwise. Staff who approve by mistake
ask the member to resubmit.

---

## Submission and review

### Member submits

1. Member opens `/member/volunteer` and reads the active roles and their job
   descriptions.
2. Member opens the Log Hours modal, picks a role, a date, a duration in
   quarter-hours, and describes what they did.
3. Service validates (see below), writes the row as `pending`, and emits
   `volunteer.hours_submitted`.
4. All staff get an in-app notification. No email — a log every few days is
   queue work, not news.

While the log is `pending`, the member can edit any field or withdraw it
entirely. Both are gone the moment staff act.

### Staff reviews

1. Staff opens `/staff/volunteer`, which lands on the Pending tab with a count
   badge.
2. Staff approves (optional note) or rejects (required note).
3. Service sets `status`, `reviewedByUserId`, `reviewedAt`, and `reviewNotes`,
   then emits `volunteer.hours_approved` or `volunteer.hours_rejected`.
4. The member gets an in-app notification and an email carrying the date, role,
   hours, and — on a rejection — the reason.

### Validation

All of it lives in the service layer, not the form.

| Rule          | Limit                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------ |
| `minutes`     | integer, `1 … VOLUNTEER_MAX_MINUTES_PER_LOG` (720). DB check constraint backstops at 1440. |
| `description` | trimmed, `1 … VOLUNTEER_DESCRIPTION_MAX` (1000)                                            |
| `reviewNotes` | `≤ 1000`; required and non-empty on reject                                                 |
| `workedOn`    | not in the future, club time                                                               |
| `workedOn`    | no earlier than `VOLUNTEER_BACKDATE_LIMIT_DAYS` (90) ago                                   |

Both date rules compare **calendar dates in club time**, not the stored instant
against `now`. Because `workedOn` is pinned to noon, an instant comparison
rejected the current day all morning — at 10am, noon today is still ahead, so
every same-day submission came back as "a future date". For the same reason the
member form's date input defaults to `clubToday()` rather than the UTC date,
which from 5pm PT onward is already tomorrow.
| `volunteerRoleId` | must exist, and must be `isActive` **on submit** |
| edit / withdraw | requires `status = 'pending'` **and** `log.userId === userId` |
| approve / reject | requires `status = 'pending'` |

**The active-role check applies to submission, not review.** A role archived
while logs sit in the queue must not strand them — staff can still approve, and
the report still resolves the role name.

---

## Reporting

`/staff/volunteer/report` takes a date range (defaulting to the current calendar
year in club time) and answers four questions, all over `status = 'approved'`
only:

- **Totals** — total hours, distinct volunteers, log count, average hours per
  volunteer. The headline numbers for a board packet.
- **By member** — paginated, hours descending, with log count and last-worked
  date. Counts distinct users, not rows.
- **By role** — with a percent-of-total column, so it is visible where the labor
  actually goes. Includes archived roles.
- **By month** — a trend table; grant applications ask for one.

Tables, not charts. There is no charting dependency in the app and this does not
justify adding one.

**Not cached.** `getCommunityStats` wraps its aggregate in a 24-hour KV cache
because public pages hit it on every request. This is a staff page over a
date-filtered table of hundreds of rows; a report that goes stale immediately
after an approval is worse than a report that takes an extra 30ms.

---

## Phase 2: opportunities and shifts

**None of this is built.** It is recorded here so the Phase 1 schema can be
judged against where it is going, and so `production-workflow-spec.md`'s deferred
staffing hook has something to point at.

The shape: a `volunteer_shift` row is a dated, time-bounded need for a
`volunteerRoleId` — "two Front Desk, Saturday 6–10pm" — optionally attached to an
`event` or (once Productions ships) a `production`. Members browse open shifts on
`/member/volunteer`, claim one, and staff confirm. A `volunteer_signup` row joins
member to shift with its own small lifecycle (`claimed → confirmed → completed`,
plus `cancelled` and `no_show`).

What connects it to Phase 1:

- `volunteer_hour_log.shiftId` becomes a real FK. A completed shift pre-fills an
  hour log — the member confirms rather than composes — and a log filed against a
  a shift can be approved with less scrutiny because staff already scheduled it.
- `volunteer_role` grows the fields only shifts need: default duration, default
  capacity, and whether the role requires training before someone may claim it
  unsupervised.
- The **auth** `volunteer` role finally gets a meaning, if we want one: "cleared
  to claim shifts unsupervised." That is the single scenario that would justify
  keeping it (see Permissions).
- The daily 09:00 shift-reminder cron from the Laravel app
  (`docs/reports/parity-report.md`) becomes buildable. It is deferred until then
  because Phase 1 has nothing to remind anyone about.
- `production_slot` gains volunteer staffing, closing the gap
  `production-workflow-spec.md` left open.

Not decided: whether shifts recur (the `recurring_series` prototype pattern would
apply), and whether members can propose a shift or only claim one.

---

## Module boundaries

### Inside the volunteering domain

- `volunteer_role` and `volunteer_hour_log` schema
- `volunteer-role-service.ts` — role CRUD, archive/restore, in-use guard
- `hour-log-service.ts` — submit, edit, withdraw, approve, reject, list
- `volunteer-report-service.ts` — the four aggregates
- `volunteer.remote.ts` — guards and form/query wiring

### Integration points

- **Feature flags** — `requireFeature('volunteering')` at the top of every remote
  function. Nav visibility keys off `layout.features.volunteering`.
- **Notifications** — three new `NOTIFICATION_TYPES` and three listeners on the
  existing domain event bus. No new Postmark templates; the generic `notification`
  alias covers all three.
- **User** — read-only. Hour logs join `user` for display and `primaryRoleFor()`
  for the `MemberLink` glyph.
- **Markdown** — job descriptions render through the existing
  `src/lib/utils/markdown.ts` and `ProseBlock`.

### What doesn't touch volunteering

- **Credits and finance** — explicitly, and there is a test.
- Reservations, bands, equipment, tickets, events, directory — no interaction in
  Phase 1. Events become a Phase 2 integration point.

---

## Schema

Two new tables, taking the app from 29 to 31.

### volunteer_role

```sql
CREATE TABLE volunteer_role (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL UNIQUE,
  description    TEXT,
  display_order  INTEGER NOT NULL DEFAULT 0,
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at     INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### volunteer_hour_log

```sql
CREATE TABLE volunteer_hour_log (
  id                   TEXT PRIMARY KEY,
  user_id              TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  volunteer_role_id    TEXT NOT NULL REFERENCES volunteer_role(id) ON DELETE RESTRICT,
  shift_id             TEXT,
  worked_on            INTEGER NOT NULL,
  minutes              INTEGER NOT NULL,
  description          TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'pending',
  reviewed_by_user_id  TEXT REFERENCES user(id) ON DELETE SET NULL,
  reviewed_at          INTEGER,
  review_notes         TEXT,
  created_at           INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at           INTEGER NOT NULL DEFAULT (unixepoch()),
  CONSTRAINT volunteer_minutes_positive CHECK (minutes > 0 AND minutes <= 1440)
);

CREATE INDEX volunteer_hour_log_user_idx      ON volunteer_hour_log(user_id);
CREATE INDEX volunteer_hour_log_status_idx    ON volunteer_hour_log(status, worked_on);
CREATE INDEX volunteer_hour_log_worked_on_idx ON volunteer_hour_log(worked_on);
CREATE INDEX volunteer_hour_log_role_idx      ON volunteer_hour_log(volunteer_role_id);
```

`status_idx` backs the pending queue, `worked_on_idx` the date-range report,
`role_idx` the by-role rollup and the delete guard.

**FK choices.** `user_id` cascades — the member is the subject of the row, so a
hard account purge should take it, matching `equipment_loan.user_id`.
`reviewed_by_user_id` is set-null, matching `content_flag.resolved_by_user_id` —
a departed staffer must not delete the review. `volunteer_role_id` restricts,
because reports depend on it resolving.

Enum tuples and limits live in `src/lib/config.ts`, not the schema file, so
Svelte pages can import them — `flag.ts` declared its tuples inline and
`/staff/flags` had to re-declare them locally as a result.

Migrations are generated with `pnpm db:generate`, not hand-written. Both tables
are purely additive.

`scripts/d1-table-order.mjs` gains `volunteer_role` then `volunteer_hour_log`,
in that order — it is the single source of truth for FK-safe insert and delete
ordering.

---

## Staff UI

Everything follows `docs/development/ui-patterns.md`.

### `/staff/volunteer` — the approval queue

Built on the work-queue pattern from `/staff/inbox`, the most recent version of
it.

- `TabBar` with count badges: Pending, Approved, Rejected, All.
- `FilterBar`: member search, role `Select`, from/to date inputs.
- `DataList` → `Table`, six columns: status glyph, member (`MemberLink`), role,
  date worked, hours (`cell-num`), actions. The description rides on the primary
  cell rather than taking a column.
- Row actions are `Action` modals: Approve with an optional note, Reject with a
  required one.
- Filter state is URL-backed so a reload keeps the view.

No `/staff/volunteer/[id]` detail route — the modal shows the whole record, and
another route is another thing to guard.

### `/staff/volunteer/roles` — role management

- `Table` of roles: name, description preview, log count, active badge, display
  order.
- Create and edit `Action` modals: name, markdown description (textarea),
  display order, active toggle.
- Archive, restore, and delete row actions. Delete on a role with logs surfaces
  `VolunteerRoleInUseError` as a message pointing at archive.

### `/staff/volunteer/report`

A separate route rather than a tab, mirroring `/staff/equipment` ↔
`/staff/equipment/loans`.

- Two date inputs, defaulting to the current calendar year.
- `StatCard` row: total hours, volunteers, logs, average per volunteer.
- By-member `DataList` + `Table`; by-role and by-month tables in `InfoCard`s.

---

## Member UI

### `/member/volunteer`

One page, three stacked parts:

1. **What you can do** — active roles as cards, each rendering its markdown job
   description through `ProseBlock`. This is the part that makes the page worth
   visiting when you have no hours to log.
2. **Your hours** — `StatCard` row (approved, pending, this year) over a `Table`
   of your logs, or an `EmptyState`.
3. **Log Hours** — an `Action` modal off the page header, not a `/new` route.
   Role select over active roles, date, hours (`step="0.25"`), description.

Edit and withdraw actions appear on `pending` rows only.

---

## Notifications

| Key                         | Trigger              | Recipient  | Channels       |
| --------------------------- | -------------------- | ---------- | -------------- |
| `volunteer_hours_submitted` | member submits a log | all staff  | in-app         |
| `volunteer_hours_approved`  | staff approves       | the member | in-app + email |
| `volunteer_hours_rejected`  | staff rejects        | the member | in-app + email |

Staff get in-app only, matching `inbox_message_received` and `content_flagged` —
routine queue work. Emailing every staffer on every log would train them to
ignore it.

Member notifications use the generic `notification` Postmark alias with detail
rows for Date, Role, and Hours, plus Reason on a rejection, and a CTA to
`/member/volunteer`. No new templates, so no `pnpm email:push`.

Staff fan-out goes through `listStaffUsers()` with a per-recipient try/catch, so
one bad address does not swallow the rest — the inbox listener's shape, not
`equipment.loan_requested`'s single-address `dispatchEmailOnly`, which produces
no in-app badge and honors no per-staff preference.

---

## Permissions

- **Log hours, edit or withdraw your own pending log**: any authenticated member.
- **Read the role list and descriptions**: any authenticated member (active roles
  only).
- **Approve or reject**: staff.
- **Create, edit, archive, or delete roles**: staff.
- **Read the report**: staff.

No new auth roles or permissions. Every remote function guards with
`requireFeature('volunteering')` and then `requireStaff()` or `requireUser()` —
the remote function is the security boundary, not the layout.

### On the existing `volunteer` auth role

`scripts/seed-dev.ts` seeds a `volunteer` auth role and grants it to six users.
It is read by **zero** code paths. `docs/specs/admin-vs-staff-spec.md` open
question 3 asks whether it means anything or is dead weight.

This module does not revive it, and recommends deleting it:

- Phase 1 is "any member may log hours." Gating on a role would _shrink_ who can
  contribute at a volunteer-run nonprofit, and would require staff to hand-grant
  a role before anyone could file a first log.
- There is no `requireVolunteer` to hang it on. Adding one lands in the middle of
  that spec's unresolved open questions 1 and 2 — a tracking module should not be
  what forces that decision.
- `primaryRoleFor()` has a fixed `admin > staff > sustaining > member` ladder that
  four list pages depend on. `volunteer` is not in it, so holders already render
  as their fallback role.
- **This module makes the role redundant by making it derivable.** After this
  ships, "who volunteers here" is a query over approved hour logs in a date
  range — true by construction, where a hand-assigned flag goes stale the moment
  someone stops showing up.

The one case that would justify keeping it is the Phase 2 "cleared to claim
shifts unsupervised" meaning. Deletion is left out of this change set so it can
be decided on its own terms.

---

## What changes

| Area                | Change                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------- |
| New schema          | `volunteer_role`, `volunteer_hour_log`                                                       |
| New services        | `volunteer-role-service`, `hour-log-service`, `volunteer-report-service`                     |
| New remote          | `src/lib/remote/volunteer.remote.ts`                                                         |
| New routes          | `/member/volunteer`, `/staff/volunteer`, `/staff/volunteer/roles`, `/staff/volunteer/report` |
| Feature flags       | `feature.volunteering`, default off                                                          |
| `src/lib/config.ts` | Status tuple, limit constants, `formatVolunteerHours()`                                      |
| `StatusBadge`       | `approved` and `rejected` mappings (both maps)                                               |
| Event bus           | 3 payloads, 3 event keys                                                                     |
| Notifications       | 3 `NOTIFICATION_TYPES`, 3 listeners                                                          |
| Nav                 | Staff Operations group, member panel                                                         |
| Seed                | Roles with job descriptions, ~50 status-weighted hour logs                                   |

## What doesn't change

| Area                                    | Notes                                                 |
| --------------------------------------- | ----------------------------------------------------- |
| Credit system                           | Untouched, by design, with a test enforcing it        |
| Finance and Stripe                      | No interaction                                        |
| Auth roles and permissions              | No new roles; the dead `volunteer` role is left alone |
| Postmark templates                      | Generic `notification` alias covers all three emails  |
| Cron and `wrangler.toml`                | Nothing scheduled — the shift reminder is Phase 2     |
| Reservations, bands, equipment, tickets | No interaction                                        |

---

## Deferred

- **Opportunities, shifts, and sign-up** — the whole of Phase 2, above. This is
  the bulk of the original IDEAS.md entry.
- **The daily 09:00 shift-reminder cron** — nothing to remind about until shifts
  exist.
- **Per-event and per-production staffing** — `production-workflow-spec.md`'s
  deferred hook lands in Phase 2.
- **CSV export** — the report is what a board packet needs, and CSV is the
  obvious next ask. Deferred because there is no CSV endpoint anywhere in this
  app yet, and the first one should set the pattern deliberately rather than as
  a sub-bullet of this feature.
- **Bulk approve** — a festival weekend produces ten logs from one member and
  one-at-a-time is tedious. It is ~20 lines, but it would be the app's first bulk
  table action and deserves its own pattern decision.
- **Skill-tag matching** — IDEAS.md's Member Skill Tags entry describes feeding
  volunteer matching. That is a Phase 2 concern at the earliest.
- **Annual report integration** — IDEAS.md's Annual Report Generator wants
  volunteer hours as a headline stat. `getVolunteerTotals` is the query it will
  call; no work needed here.

---

## Open questions

1. **`VOLUNTEER_BACKDATE_LIMIT_DAYS = 90`.** Too tight and someone loses a busy
   season's hours after a stretch of not logging; too loose and the "this
   quarter" figure keeps moving under the board. It is a constant, changeable
   without a migration, but the collective's actual reporting cadence should set
   it rather than this guess.
2. **The seeded role list.** Only three role names exist anywhere in the repo
   today (a seed inbox fixture: sound engineer, event setup, front desk). The
   rest of the seeded set is inferred venue ops. Unlike an enum this is now
   trivially editable in the UI, so the cost of being wrong is a few minutes of
   typing — but it is worth a look from whoever actually schedules volunteers.
