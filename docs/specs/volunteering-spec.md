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
staff-approved. Two further pieces are designed here but **not built** — Phase 2
(volunteer opportunities and shifts, member sign-up, per-event staffing) and
certifications (who is cleared for what, and when that lapses). The Phase 1
schema anticipates them and nothing more.

Approved volunteer hours are a record, not a currency. They do not grant
practice-room credits and they never touch the finance ledger.

The module ships behind a `volunteering` feature flag, default off. Per #171 the
flag gates the **member** surface only — the staff panel always shows
volunteering, so staff can define roles and work the queue before it is switched
on for everyone, and keep administering it if it is switched back off.

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
  group          text               — at-shows | away-from-shows | committee
  displayOrder   integer            — sort order in pickers and reports
  isActive       boolean            — false = archived; hidden from the submit form only
  createdAt      timestamp
  updatedAt      timestamp
```

`group` is presentation only: it buckets the roles under three headings on the
member picker and the staff interest filter. Nothing branches on it, so a role
in the wrong group is a cosmetic bug rather than a broken workflow.

### Role interest

A member's standing "I'd help with this" — the gap between someone reading
`/contribute` and someone logging hours. It says who to contact when a role
needs filling; it is not a commitment to a date, which is what a Phase 2 shift
claim would be.

```
volunteer_role_interest
  id                uuid pk
  userId            uuid fk → user            (cascade — the member is the subject)
  volunteerRoleId   uuid fk → volunteer_role  (cascade — unlike a log, no history to keep)
  createdAt         timestamp
  unique (userId, volunteerRoleId)
```

The member owns the set outright and staff never edit it, so the only mutation
is "replace my set with this one". There is no status column: the row exists or
it doesn't. Interests are member-only by design — an earlier draft took
anonymous public sign-ups, which needed Turnstile, a parallel identity keyed by
email, and its own unsubscribe tokens; requiring a (free) account deletes all
three problems.

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

Role interest (built) is the standing half of this: it records who _would_ do a
job. A shift is the dated half — who is doing it on Saturday. The natural join is
that the claim UI offers shifts for roles you have expressed interest in first.

The shape: a `volunteer_shift` row is a dated, time-bounded need for a
`volunteerRoleId` — "two Front Desk, Saturday 6–10pm" — optionally attached to an
`event` or (once Productions ships) a `production`. Members browse open shifts on
`/member/volunteer`, claim one, and staff confirm. A `volunteer_signup` row joins
member to shift with its own small lifecycle (`claimed → confirmed → completed`,
plus `cancelled` and `no_show`).

What connects it to Phase 1:

- `volunteer_hour_log.shiftId` becomes a real FK. A completed shift pre-fills an
  hour log — the member confirms rather than composes — and a log filed against a
  shift can be approved with less scrutiny because staff already scheduled it.
- `volunteer_role` grows the fields only shifts need: default duration and
  default capacity. "Requires training" is **not** one of them — that is what
  certifications express, and it is where shift-claiming gets gated.
- Certifications stop being advisory and start gating: a member may only claim a
  shift for a role whose required certifications they currently hold.
- The daily 09:00 shift-reminder cron from the Laravel app
  (`docs/reports/parity-report.md`) becomes buildable. It is deferred until then
  because Phase 1 has nothing to remind anyone about.
- `production_slot` gains volunteer staffing, closing the gap
  `production-workflow-spec.md` left open.

Not decided: whether shifts recur (the `recurring_series` prototype pattern would
apply), and whether members can propose a shift or only claim one.

---

## Certifications

**None of this is built either.** It is a sibling of Phase 2 rather than part of
it: certifications are useful on their own — they answer "who can run the desk?"
without any shift scheduling — but they are also what Phase 2 checks before
letting someone claim a shift. Either can be built first; building
certifications first is the smaller piece and makes Phase 2 smaller in turn.

Some volunteer work needs clearance before someone does it alone. Two different
things wear that name and the model has to hold both:

- **Internal clearances** the collective grants itself — "cleared on the sound
  desk", "holds a door code". No issuer, usually no expiry.
- **External cards** a member brings — Food Handler, First Aid/CPR, OLCC alcohol
  service. Issued by somebody else, carry a number, and _lapse_.

### Key concepts

**A certification is a thing, not a property of a role.** First Aid is not a
volunteer role and never will be, and one clearance frequently covers several
roles — sound desk clearance applies to Sound Engineering and to Load-Out. So
certifications live in their own catalog and roles _reference_ them, rather than
each role carrying a `requiresTraining` flag. The alternative was considered and
rejected: it has nowhere to put First Aid, and forces training that clears two
roles to be recorded twice.

**Held certifications are append-only, not overwritten on renewal.** A renewal
writes a new row. This is not tidiness — it is the only way to answer the
question that actually gets asked after an incident: _was their First Aid current
on the day they worked that shift?_ Overwriting the grant date destroys exactly
that. "Does this member hold X **now**" is the most recent row by `grantedAt`.

**Expiry is derived from dates, never stored as a status.** A `status` column
saying `expired` is wrong the moment the clock passes midnight, and keeping it
right needs a cron whose only job is to age rows. Current / expiring soon /
expired is computed from `expiresAt` against today in club time, the same way
the rest of this module compares dates.

**`expiresAt` is stamped at grant time, not computed on read.** It is derived
from the catalog's `validityMonths` when the record is created and then stored.
Computing it live would mean that editing "Food Handler: 3 years" to 2 years
retroactively expires cards that were validly issued for three.

**Certifications are advisory in Phase 1 and never block logging hours.** Someone
who did the work should be able to record it; refusing the hours does not un-do
the work, it just loses the data. The staff review queue flags a log whose role
requires a certification the member did not hold **on the date worked** — which
is a prompt to have a conversation, not a rejection. Gating belongs at
shift-claiming, where it prevents something.

### Domain model

#### Certification

The catalog. Staff-managed, same shape and rules as a volunteer role.

```
volunteer_certification
  id              uuid pk
  name            text unique   — "Sound Desk Cleared", "Food Handler"
  description     text?         — markdown: what it covers, how to get it
  issuedBy        text?         — null = internal to CMC; "Oregon Health Authority" etc.
  validityMonths  integer?      — null = does not expire
  displayOrder    integer
  isActive        boolean       — archived; hidden from the grant form only
  createdAt       timestamp
  updatedAt       timestamp
```

#### Held certification

One member holding one certification, once. Renewals append.

```
member_certification
  id                uuid pk
  userId            uuid fk → user                     cascade
  certificationId   uuid fk → volunteer_certification  restrict
  grantedAt         timestamp   — calendar date, noon club time
  expiresAt         timestamp?  — stamped from validityMonths at grant; null = never
  grantedByUserId   uuid? fk → user                    set null
  reference         text?       — external card or licence number
  notes             text?
  revokedAt         timestamp?  — pulled early; null = not revoked
  revokedReason     text?       — required when revokedAt is set
  revokedByUserId   uuid? fk → user                    set null
  createdAt         timestamp
  updatedAt         timestamp
```

No unique constraint on `(userId, certificationId)` — that is the append-only
decision made structural.

##### Revocation

**Pulling a clearance is recorded, not deleted.** The distinction that matters is
not whether there was fault; it is **whether the record was ever true**:

| Case                                | Action                                             |
| ----------------------------------- | -------------------------------------------------- |
| Typo, wrong member, never relied on | Hard delete — it was never true                    |
| Was true, is not now — any reason   | Set `revokedAt` — the window it covered is history |

Deleting a clearance that someone actually held destroys the answer to "were they
cleared on the night of the incident?", which is the entire reason this table is
append-only. That holds regardless of why it was pulled — and it holds even if
the member is later banned outright, because you still want the record of what
they were cleared for while they worked.

The reasons are mostly blameless, which is why "just ban them" is not the
alternative: a volunteer who keeps mis-patching the desk loses that clearance and
keeps doing load-out; a replaced desk voids everyone's clearance on the old one;
an external card can be pulled by its issuer; someone joining the board should
stop handling door cash. Revocation is also the proportionate middle rung for
conduct that does not warrant losing a member — pull the solo clearance, require
supervision.

`revokedReason` is required whenever `revokedAt` is set, for the same reason a
rejected hour log needs one: the next staffer looking at the list needs to know
why this person is no longer on it.

#### Role requirement

```
volunteer_role_certification
  volunteerRoleId   uuid fk → volunteer_role           cascade
  certificationId   uuid fk → volunteer_certification  cascade
  primary key (volunteerRoleId, certificationId)
```

Cascade on both sides: this row is a link, not a record of anything that
happened, so deleting either end should take it. That is the difference from
`member_certification`, which restricts — a held certification is history.

Three tables, taking the app from 31 to 34.

### Derived state

| State             | Condition                                                                    |
| ----------------- | ---------------------------------------------------------------------------- |
| **current**       | `revokedAt` null, `grantedAt <= today`, and (`expiresAt` null or `>= today`) |
| **expiring soon** | current, and `expiresAt` within `CERT_EXPIRY_WARNING_DAYS` (60)              |
| **expired**       | `revokedAt` null and `expiresAt < today`                                     |
| **revoked**       | `revokedAt <= today`                                                         |
| **never held**    | no row                                                                       |

All comparisons against today in club time, via `clubToday()` — the same rule
that keeps same-day hour logging working.

"Was this member cleared on a given date" is the same predicate with `today`
swapped for the date worked, and it is the whole reason for the shape:

```
grantedAt <= worked
  and (expiresAt is null or expiresAt >= worked)
  and (revokedAt is null or revokedAt  >  worked)
```

Note `revokedAt > worked`, not `>=`: a clearance pulled _on_ the day of a shift
was not in force for that shift. Expiry uses `>=`, because a card is valid
through its expiry date. The asymmetry is deliberate and easy to get backwards.

### Staff UI

- **`/staff/volunteer/certifications`** — the catalog, mirroring
  `/staff/volunteer/roles` exactly: table, create/edit modals, archive rather
  than delete, and delete offered only for an entry nothing references. Editing
  `validityMonths` warns that it applies to future grants only.
- **Role editing** gains a required-certifications multi-select (`TagInput`).
- **Member detail** gains a Certifications card: what they hold, when granted,
  when it expires, who granted it, and a Grant action. Revoke takes a required
  reason. Delete is offered only for a record created today by the same staffer
  — the correcting-a-typo window — so that the ordinary way to end a clearance
  is the one that keeps its history.
- **The review queue** shows a warning glyph on a log whose role required a
  certification the member did not hold on the date worked. Advisory only.
- **A "clearances" view** — who is current, who is expiring, who has lapsed —
  is the natural companion to the hours report. Worth building with the catalog
  rather than after it.

### Member UI

`/member/volunteer` gains a Certifications block: what you hold, what expires
when, and — for a role you are not cleared for — what the role requires and how
to get it (the catalog's markdown description is where that copy lives). This is
the part that turns the page from a form into something worth opening.

### Permissions

- **Grant, edit, revoke a member's certification**: staff. Revocation records who
  did it and why, so it is attributable the way an hour-log rejection is.
- **Manage the catalog and role requirements**: staff.
- **See your own certifications**: any member.
- **See anyone's**: staff.

No new auth roles — and this is what finally closes the question about the old
one. The single scenario that would have justified keeping the dead `volunteer`
auth role was expressing "cleared to claim shifts unsupervised". A certification
expresses that strictly better: it is per-role rather than global, it records
who cleared them and when, and it can lapse. The recommendation to delete the
auth role is now unconditional.

### Deferred within certifications

- **Expiry reminders.** A daily cron mailing members whose card lapses inside
  the warning window, and staff a digest. Wants a `volunteer_certification_expiring`
  notification type. Deferred because it is only worth building once real expiry
  dates are in the table — and it should be folded into the Phase 2 shift-reminder
  cron rather than shipping a second daily job.
- **Evidence upload.** Photographing a Food Handler card. Needs the media work
  in the parity report's enhancements section; `reference` carries the number in
  the meantime.
- **Self-service claims.** A member asserting they hold a card, pending staff
  verification. Phase 1 of this is staff-entered only, which is the honest
  default for something that gates work.

---

## Module boundaries

### Inside the volunteering domain

- `volunteer_role`, `volunteer_hour_log` and `volunteer_role_interest` schema
- `volunteer-role-service.ts` — role CRUD, archive/restore, in-use guard
- `volunteer-interest-service.ts` — set/read a member's interests, list them for staff
- `hour-log-service.ts` — submit, edit, withdraw, approve, reject, list
- `volunteer-report-service.ts` — the four aggregates
- `volunteer.remote.ts` — guards and form/query wiring

### Integration points

- **Feature flags** — `requireFeature('volunteering')` at the top of every
  **member** remote function, and on the member nav item. Staff remotes and the
  staff nav deliberately omit it (#171).
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

Two new tables, taking the app from 29 to 31. The certification tables below are
designed, not created — see [Certifications, unbuilt](#certifications).

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

### Certification tables (designed, not created)

```sql
CREATE TABLE volunteer_certification (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL UNIQUE,
  description      TEXT,
  issued_by        TEXT,
  validity_months  INTEGER,
  display_order    INTEGER NOT NULL DEFAULT 0,
  is_active        INTEGER NOT NULL DEFAULT 1,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  CONSTRAINT validity_months_positive CHECK (validity_months IS NULL OR validity_months > 0)
);

CREATE TABLE member_certification (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  certification_id   TEXT NOT NULL REFERENCES volunteer_certification(id) ON DELETE RESTRICT,
  granted_at         INTEGER NOT NULL,
  expires_at         INTEGER,
  granted_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  reference          TEXT,
  notes              TEXT,
  revoked_at         INTEGER,
  revoked_reason     TEXT,
  revoked_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at         INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at         INTEGER NOT NULL DEFAULT (unixepoch()),
  -- A revocation without a reason is unactionable for whoever reads the list next.
  CONSTRAINT revoked_has_reason CHECK (
    revoked_at IS NULL OR (revoked_reason IS NOT NULL AND length(trim(revoked_reason)) > 0)
  )
);

CREATE TABLE volunteer_role_certification (
  volunteer_role_id TEXT NOT NULL REFERENCES volunteer_role(id) ON DELETE CASCADE,
  certification_id  TEXT NOT NULL REFERENCES volunteer_certification(id) ON DELETE CASCADE,
  PRIMARY KEY (volunteer_role_id, certification_id)
);

-- "what does this member currently hold", the query every screen runs
CREATE INDEX member_certification_user_idx ON member_certification(user_id, certification_id, granted_at);
-- the expiring-soon sweep and the future reminder cron
CREATE INDEX member_certification_expiry_idx ON member_certification(expires_at)
  WHERE expires_at IS NOT NULL;
```

Deliberately **no** unique constraint on `(user_id, certification_id)`: renewals
append, and a unique index would forbid exactly the history the model exists to
keep. `granted_at` is the third column of the user index so "most recent grant"
is an index scan rather than a sort.

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

No new auth roles or permissions. Every remote function guards — the remote
function is the security boundary, not the layout. Staff functions call
`requireStaff()` alone; member functions call `requireFeature('volunteering')`
and then `requireUser()`, because the flag gates the member surface only.

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

The one case that would have justified keeping it — "cleared to claim shifts
unsupervised" — is answered better by a certification, which is per-role, dated,
attributable, and able to lapse. Nothing is left arguing for the auth role.
Deletion is still left out of this change set so it can be done on its own
terms, but it is no longer a question of _whether_.

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
- **Certifications** — designed above. The smaller of the two unbuilt pieces,
  and it makes Phase 2 smaller, so it is the better one to build next.
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

None. Everything below was asked and answered during design; the answers are
kept so nobody re-opens them from scratch.

### Settled

- **`VOLUNTEER_BACKDATE_LIMIT_DAYS = 90`** — reviewed and kept. Fine to begin
  with; it is a constant, so changing it later costs nothing and needs no
  migration.
- **`CERT_EXPIRY_WARNING_DAYS = 60`** — reviewed and kept, on the same terms. It
  has no effect until the expiry-reminder cron is built.
- **The seeded role list** — left as seeded. Five of the eight names were
  inferred rather than drawn from the repo, but the catalog is staff-editable,
  so correcting them is typing rather than a migration. Not worth blocking on.
- **Which certifications CMC tracks** — First Aid and Food Handler are expected
  eventually, alongside internal sound-desk clearance. `issuedBy`,
  `validityMonths` and `reference` therefore all earn their place, and the
  standalone catalog is the right model: a role-attached training flag would
  have had nowhere to put either card.
- **Revoking a certification** — recorded, not deleted. See
  [Revocation](#revocation).
