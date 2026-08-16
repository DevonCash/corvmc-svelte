# Groups Module

A group is a set of CMC members who organize together — a band, a club, or a committee. Groups own a roster, post announcements to their members, keep shared documents, and run events. A band additionally has a **band profile**: the public-facing musical identity (genres, hometown, links, EPK, premium microsite) that a club or committee has no use for.

The driving case is the Real Book Club jazz jam: a CMC program with a roster, a recurring session anyone may drop into, a way to tell its members when a session moves, and somewhere to keep the charts. Everything in this spec should be checked against whether it serves that.

This spec splits today's `band` table in two. `group` is the managed organization; `band_profile` is the band's presentational data. The split is what lets clubs and committees reuse the roster machinery without inheriting band-shaped columns — and what lets a touring act exist as a staff-kept record with no roster at all.

**Classes are deliberately out of scope.** A class needs enrollment, not membership — term boundaries, attendance, completion — and none of that is expressible as a roster. See [Deferred](#deferred).

> This spec is the source of truth for the band/group boundary. Where
> [production-workflow-spec.md](production-workflow-spec.md) describes external acts as `band` rows,
> this spec supersedes it.

---

## Domain model

### The split

| Entity         | Owns                                                                                                                  | Stands alone                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `group`        | kind, name, slug, description, avatar, public visibility, join instructions, roster, announcements, documents, events | Yes — a club with no band profile           |
| `band_profile` | tagline, hometown, founded year, genres, links, tier & subscription, EPK, microsite config, media                     | Yes — a touring act, as a staff-kept record |
| the link       | `band_profile.groupId` — nullable, unique                                                                             | A CMC member band is both                   |

Three kinds of group:

```
group.kind  'band' | 'club' | 'committee'
```

**Roles and membership behave identically across all three.** Owner, admin, and member mean the same thing everywhere; announcements, documents, and the roster are one implementation. What kind does determine is the line below, which is a governance fact rather than a UI one:

|                                   | `band`                                  | `club`, `committee`                      |
| --------------------------------- | --------------------------------------- | ---------------------------------------- |
| Created by                        | Any member, self-service                | **Staff only**, from the staff panel     |
| Owner                             | The creator                             | **Appointed by staff**                   |
| Deleted by                        | Its owner                               | Staff only                               |
| Has a band profile                | Yes                                     | No                                       |
| Default join policy               | `invite_only`                           | Either; `open` is the point of a program |
| Its events may hold the room free | No                                      | **Yes**                                  |
| Rehearsal bookings                | `bookerType: 'band'`, credits then cash | n/a — see [Room time](#room-time)        |

**A club or committee is a sanctioned CMC program by construction.** There is no `sanctioned` flag, because the existence of the row is the sanction — staff created it and staff appointed whoever runs it. A band is the opposite: a member's own project, self-created, paying for its own rehearsal time.

That distinction is what makes free room time safe to grant. An earlier draft proposed a `sanctioned` boolean so staff could bless individual groups; it is unnecessary once members cannot create clubs at all. The abuse case — spin up a fake club, give it a weekly "event," collect free room time — is closed structurally rather than by a check someone has to remember.

Adding a kind later is a one-line change to this union plus a row in that table.

### Group

```
group
  id                 text (uuid), PK
  kind               text, not null   ('band' | 'club' | 'committee')
  name               text, not null
  slug               text, not null, unique
  description        text, nullable
  avatarKey          text, nullable   (R2 storage key)
  publicVisibility   text, not null, default 'public'   ('public' | 'members' | 'hidden')
  joinPolicy         text, not null, default 'invite_only'   ('invite_only' | 'open')
  joinInstructions   text, nullable
  lookingForMembers  boolean, not null, default false
  contact            json, nullable   (public contact preferences)
  createdAt          timestamp, not null
  updatedAt          timestamp, not null
  deletedAt          timestamp, nullable
```

**Slugs live here and nowhere else.** `group.slug` is the only slug in the system — `band_profile` has none — so a plain unique index is the whole namespace enforcement: no registry table, no dual-write, no second source of truth. It follows that **a thing is publicly addressable if and only if it has a group**, which is a structural fact rather than a filter anyone can forget to apply.

The index is `unique(slug)`, not `unique(kind, slug)`: one namespace shared by bands, clubs, and committees alike. A per-kind namespace would work, but it would make `requireGroupRole({ slug })` ambiguous — see [Decisions that were open](#decisions-that-were-open).

**There is no `ownerId`.** The owner is the `group_member` row with `role = 'owner'`, enforced by a partial unique index. See [Ownership](#ownership).

**`joinPolicy` is how open enrollment works.** `invite_only` is today's behavior and stays the default: you get in because someone with authority added you. `open` means any signed-in member may join themselves, landing directly on an active `member` row with no approval step — which is the whole point of a drop-in program like the Real Book Club. The policy governs only self-service joining; invitations work identically under both.

`joinInstructions` remains useful under `open` — it is the "bring a horn, charts provided" prose next to the button, not a substitute for it.

### Band profile

```
band_profile
  id            text (uuid), PK
  groupId       text, nullable, unique, FK → group (set null on delete)

  -- identity: populated ONLY when groupId IS NULL
  name          text, nullable
  description   text, nullable
  avatarKey     text, nullable

  -- always on the profile
  tagline       text, nullable
  hometown      text, nullable
  foundedYear   text, nullable
  links         json, nullable
  tier          text, not null, default 'free'   ('free' | 'premium')
  subscription  json, nullable
  createdAt     timestamp, not null
  updatedAt     timestamp, not null
```

**The identity rule: when `groupId` is set, name/description/avatar live on the group, and the profile's copies are NULL.** Exactly one non-null name exists for any band at any moment.

The alternative — keeping both populated and syncing on write — was rejected. Two live copies of a name drift the first time any write path forgets one, and the column would mean two different things depending on whether `groupId` happened to be set. Under this rule the column means one thing: _the name of a band that has no group_. Claiming a touring act becomes an explicit operation rather than a silent divergence — see [Claiming a touring act](#claiming-a-touring-act).

This is enforced in the service layer, not as a CHECK constraint. Adding a CHECK to SQLite forces a full table rebuild, which is dangerous on D1 — see [table rebuilds on D1](../development/conventions.md#table-rebuilds-on-d1). The schema carries a comment saying so, because otherwise someone will helpfully add the constraint and trigger the rebuild.

`band_genre`, `band_page_config`, and `band_media` all re-key from `bandId` to `bandProfileId`.

#### An unclaimed act has no page anywhere

**A touring act is a staff-facing record and nothing else.** There is no public profile, no share link, no short id, no `noindex` page — nothing rendered to the world at any URL. It is a row staff can see, and that is the whole of it.

This is the point of `directoryVisibility` and slugs being a member benefit, taken to its conclusion. CMC does not host a page for a band that has no relationship with CMC; the band already has a web presence it chose — a Linktree, a Bandcamp, an Instagram — and that is where anyone who wants to find them should land.

So **public attribution links out, never in.** Wherever an unclaimed act's name appears publicly — a lineup, a run of show, an event page — it renders as:

- a link to the act's own URL, taken from `band_profile.links`, when they have given one; or
- **plain text** when they have not.

Never a link to a CMC page, because there is no CMC page to link to. This replaces the earlier rule about gating links on directory visibility: there is now no case where an unclaimed act's name resolves to something we host.

An earlier draft gave unclaimed acts a `publicId` and a `/a/{publicId}` share page, on the theory that staff would want to forward an act's record to a promoter. That was solving a problem nobody has — a promoter wants the band's own links, not our copy of them — and it created a page holding third-party information that we would then have to reason about the exposure of. It is gone, along with the `publicId` column.

#### The contact-sheet link

There is exactly one reason an unclaimed act needs a URL: **so they can fill in their own details.** Staff stub an act when booking it, and the act itself is the best source for its bio, genres, links, photo, and booking contact. Asking staff to retype what an act emails them is how records go stale.

That is a **write** surface, not a read one, so it is gated — by an emailed magic link rather than an account:

```
band_profile_link
  id             text (uuid), PK
  bandProfileId  text, not null, FK → band_profile (cascade)
  token          text, not null, unique
  email          text, not null      — where it was sent; the only address it is valid for
  expiresAt      timestamp, not null
  createdById    text, nullable, FK → user (set null on delete)
  lastUsedAt     timestamp, nullable
  revokedAt      timestamp, nullable
  createdAt      timestamp, not null
```

Staff send it from the act's record. The act clicks `/act/{token}` and gets a form for its own descriptive fields and contact details. It is **reusable until it expires** — filling in a contact sheet is not always one sitting — and revocable, and it expires on its own so a forwarded link does not stay live forever.

Three constraints that matter:

- **It creates no session and no account.** The token authorizes editing exactly one `band_profile` and nothing else. It must not touch `locals.user`, and it must not be confused with authentication. Do not reach for better-auth's magic-link plugin here — the app is email+password only today, and adding a passwordless path to the real auth system to solve a data-entry problem would be a much larger change with a much larger blast radius.
- **It cannot change the name.** Staff control the canonical name, because it appears on posters and in settlement records. The act edits everything descriptive; renaming is a conversation.
- **Claiming is a different door.** This link says "keep your record current and stay external." Becoming a CMC band — a group, a slug, a real profile — is a `group_invite` with `role: 'owner'`, described in [Claiming a touring act](#claiming-a-touring-act). Conflating them would mean an act updating its bio accidentally acquires a membership.

`platform_invite` already establishes this shape: unique token, expiry, resolved at a public route. This is the same pattern narrowed to one row and one form.

### GroupMember

Tracks membership and pending invitations in one table, exactly as `band_member` does today. Every row is either a pending invitation or an active membership.

```
group_member
  id                  text (uuid), PK
  groupId             text, not null, FK → group (cascade)
  userId              text, not null, FK → user (cascade)
  role                text, not null   ('owner' | 'admin' | 'member')
  position            text, nullable   (e.g. "Lead Guitar", "Treasurer", "Instructor")
  status              text, not null   ('pending' | 'active')
  notifyAnnouncements boolean, not null, default true
  invitedById         text, nullable, FK → user (set null on delete)
  createdAt           timestamp, not null
  updatedAt           timestamp, not null
  unique(groupId, userId)
  unique(groupId) where role = 'owner'
```

- Owner row: `role = 'owner'`, `status = 'active'`, `invitedById = null`.
- Invited member: `role = 'member' | 'admin'`, `status = 'pending'`, `invitedById` set.
- Accepting flips `status` to `'active'`. Declining or revoking deletes the row.
- `position` is free text and carries whatever the group calls it — instrument for a band, office for a committee, "host" or "chart librarian" for a club.
- `notifyAnnouncements` is the per-group mute. A member of six groups needs to silence one without silencing all; a single global preference cannot express that.

**Membership is not polymorphic.** Because everything managed is a group, `groupId` is a real foreign key with `ON DELETE CASCADE` — as are `group_invite`, `announcement`, and `file`. This is the single largest simplification in the design. A polymorphic `(entityType, entityId)` shape would have required a `purgeEntity()` helper called from every delete path, an orphan-reconcile cron, and a discriminator branch in every query. It would also have invited the bug `content_flag` already has: its rows are never cleaned up when a band is deleted, because there is no FK to enforce it.

### Ownership

A group has **at most one** owner: the `group_member` row with `role = 'owner'`, guaranteed by `unique(groupId) where role = 'owner'`. A partial unique index permits zero, which is deliberate — see [Resigning a leadership](#resigning-a-leadership).

This spec drops `band.ownerId` rather than carrying it across. Authorization never reads it today — `requireBandOwner()` resolves through `getUserRole()`, which reads `band_member` alone — so every remaining use is display or bookkeeping, and all of it is derivable. `transferOwnership()` already performs its three writes in a single `db.batch([...])`; dropping the column removes one statement from a batch that already spans the other two, so the atomicity guarantee is unchanged.

Dropping it also retires a live contradiction. The migration declares `owner_id text NOT NULL` with `FOREIGN KEY ... ON DELETE SET NULL` — two clauses that cannot both be satisfied, so deleting a user who owns a band would fail at the constraint. The Drizzle definition says `onDelete: 'restrict'`, so schema and migration disagree about the intent as well. `purgeUser()` guards it in application code, which is why nobody has hit it.

**A group with no owner is legal**, and it is a normal transient state: a program whose leader stepped down and whose replacement has not been appointed yet. The program keeps running — its sessions, roster, documents, and announcements are untouched — and staff see it flagged in `/staff/groups` until someone is appointed. Making an ownerless group illegal would mean either trapping a leader in the role or dissolving a working program the moment they resign, and neither is right.

Admins keep working while the owner seat is empty; only owner-exclusive actions (transferring ownership, and deleting a band) are unavailable, and for a program those belong to staff anyway.

### Announcement

```
announcement
  id              text (uuid), PK
  groupId         text, not null, FK → group (cascade)
  authorId        text, nullable, FK → user (set null on delete)
  title           text, not null          (max 200)
  body            text, not null          (markdown, max 10000, sanitized)
  pinned          boolean, not null, default false
  publishedAt     timestamp, nullable
  notifiedAt      timestamp, nullable     (fan-out latch — see Notifications)
  recipientCount  integer, nullable
  createdAt       timestamp, not null
  updatedAt       timestamp, not null
  deletedAt       timestamp, nullable
```

`notifiedAt` is written by the fan-out listener and never by the remote function. It is the idempotency guarantee, not a display field.

### File

```
file
  id            text (uuid), PK
  groupId       text, not null, FK → group (cascade)
  key           text, not null, unique     (private R2 object key)
  filename      text, not null             (original name, sanitized)
  contentType   text, not null
  sizeBytes     integer, not null
  description   text, nullable
  uploadedById  text, nullable, FK → user (set null on delete)
  createdAt     timestamp, not null
  updatedAt     timestamp, not null
  deletedAt     timestamp, nullable
```

The row id goes in the R2 key, not the filename — two uploads named `rider.pdf` must not collide, and the key must not be guessable from the display name.

### GroupInvite

Replaces `platform_invite`. Covers only the **email** path: inviting someone who has no account yet.

```
group_invite
  id            text (uuid), PK
  groupId       text, not null, FK → group (cascade)
  email         text, not null              (normalized lowercase)
  token         text, not null, unique
  role          text, not null              ('owner' | 'admin' | 'member')
  position      text, nullable
  invitedById   text, nullable, FK → user (set null on delete)
  status        text, not null, default 'pending'   ('pending' | 'accepted' | 'revoked')
  expiresAt     timestamp, not null
  createdAt     timestamp, not null
  acceptedAt    timestamp, nullable
  unique(groupId, email) where status = 'pending'
```

**Two invite mechanisms, deliberately.** Inviting an existing member stays a `group_member` row with `status = 'pending'` — that row _is_ the invitation, it appears on the invitee's dashboard, and accepting is a status flip. Only the non-user case needs a token and an expiry. Merging them would hang nullable `token`/`email`/`expiresAt` columns off every pending membership and add a branch to the accept path, to unify two flows that genuinely differ.

`invitedById` is **nullable** here. Today's `platform_invite.invitedById` is declared `.notNull()` _and_ `onDelete: 'set null'` — contradictory clauses, so deleting a user who ever sent an invite fails on a NOT NULL violation. The new table is a fresh create, so fixing it is free.

The partial unique index replaces the manual "is there already a pending invite" SELECT in `createInvite`; an `onConflictDoUpdate` refreshes the expiry instead.

### Events

`event.bandId` becomes **`event.groupId`**. The column marks who manages the event and on whose page it appears — it is authority, not billing. A new join table carries billing:

```
event_group
  eventId    text, not null, FK → event (cascade)
  groupId    text, not null, FK → group (cascade)
  sortOrder  integer, not null, default 0
  unique(eventId, groupId)
```

The managing group is inserted as the first row automatically, so no read path needs a "sometimes present, sometimes not" branch. `eventSources` extends to `['cmc', 'band', 'group']`.

**`event_group` versus `production_slot`.** These will collide unless the line is drawn now:

| Table             | Models                                       | Carries                                              | Used by                   |
| ----------------- | -------------------------------------------- | ---------------------------------------------------- | ------------------------- |
| `production_slot` | The **run of show** for a CMC-produced event | Set times, set lengths, ordering, per-act settlement | CMC productions           |
| `event_group`     | **Shared advertising** on a member event     | Which groups' pages show it, display order only      | Band/club-authored events |

A CMC production uses `production_slot`. A member-authored event uses `event_group`. Nothing uses both.

Adding `groupId` and the join table are plain `ALTER TABLE ADD COLUMN` / `CREATE TABLE` operations, and extending the `source` enum emits **zero SQL** — it is a TypeScript-only constraint in Drizzle's SQLite dialect. Generalizing instead to `ownerType`/`ownerId` was rejected: it would force a rebuild of `event`, which has more children than any other table (`ticket`, `event_rsvp`, `recurring_series`, `reservation`) and is the riskiest rebuild in the schema.

### Room time

A program does not book the room the way a band does. It gets the room **through its event**, free, and the mechanism already exists — it just isn't reachable from outside the staff panel today:

| Path                              | Reserves the room                                                 | Cost               |
| --------------------------------- | ----------------------------------------------------------------- | ------------------ |
| Member or band rehearsal          | `bookerType: 'user' \| 'band'`                                    | Credits, then cash |
| Staff CMC event — `create()`      | `bookerType: 'event'`, via `staffCreate`, straight to `confirmed` | **Free**           |
| Band event — `createBandEvent()`  | **Nothing.** It is an off-site gig listing with a `location`      | n/a                |
| **Club or committee event — new** | `bookerType: 'event'`, same path as a CMC event                   | **Free**           |

So a group event needs a `createGroupEvent()` that takes optional reservation params and routes them through `staffCreate` with `bookerType: 'event'`, exactly as `create()` does at `event-service.ts:113` — including the `hasConflict` pre-check and the compensating delete if the event insert fails. Recurring group sessions need the same on each generated occurrence.

**No new `bookerType` value, and no credit accounting.** The reservation belongs to the event, not the group, so nothing in the booker polymorphism changes and no credit ledger is touched. `bookerType: 'group'` would imply a group has a balance to spend, which is precisely what a sanctioned program does not need.

This is why free room time is safe: only staff create clubs and committees, so only staff decide who may hold the room this way. The privilege travels with the kind, not with a per-event approval.

Bands are excluded deliberately. A band event is an off-site gig listing and does not reserve anything; a band rehearsal is private paid time under `bookerType: 'band'`. Neither becomes free, and a band cannot reach the free path by creating an "event" for its own rehearsal.

---

## Roles and permissions

Three roles within a group, checked at the service level. Identical across all three kinds.

| Role   | Post announcements | Upload documents | Invite | Remove members | Edit group | Manage events | Transfer ownership | Delete group |
| ------ | ------------------ | ---------------- | ------ | -------------- | ---------- | ------------- | ------------------ | ------------ |
| owner  | ✅                 | ✅               | ✅     | ✅             | ✅         | ✅            | ✅                 | Bands only   |
| admin  | ✅                 | ✅               | ✅     | ✅ (not owner) | ✅         | ✅            | ❌                 | ❌           |
| member | ❌                 | ❌               | ❌     | ❌             | ❌         | ❌            | ❌                 | ❌           |

Members read announcements and download documents; they do not create them. Staff (`admin` or `staff`) can manage any group from the staff panel.

**Deleting a club or committee is staff-only**, unlike a band. An appointed program leader runs the program; they do not own it, and they should not be able to dissolve a CMC program on their own — the same reason they could not create it. A leader who wants out transfers ownership or leaves; ending the program is a staff decision. This is the one place the role table differs by kind.

### The guard

`requireGroupRole()` replaces `band-context.ts`:

```ts
requireGroupRole(
  ref: { slug: string } | { id: string },
  minRole: 'owner' | 'admin' | 'member',
  opts?: { allowStaff?: boolean }
): Promise<GroupContext>
```

**The ref is an explicit argument, never read from `params`.** Today's `requireBandBySlug()` reads `getRequestEvent().params.slug` across ~55 call sites. SvelteKit's own documentation is explicit that `params` in a remote function describe the _calling page_, are client-manipulable, and must never determine authorization. It is safe today only incidentally — the slug is a lookup key and the role check still runs against the resolved band — but it cannot serve two route roots without sniffing `route.id`, which is the same untrusted value.

The drift is already visible: `createBandEventForm` declares `slug` in its Zod schema and then ignores it, calling `requireBandAdmin()` which reads `params.slug`. The field is decorative and there are two sources of truth for one value.

Passing the ref explicitly is not a security regression. The slug is a lookup key, not a capability: the guard resolves the group from the untrusted slug and then checks the caller's own membership on the resolved group, so spoofing a slug lands you somewhere you have no role and yields 403.

**The invariant that matters: child-row ids from the client are always re-scoped to the resolved group.** `band-service.ts` already gets this right, and its comment already explains why:

> When `bandId` is provided (band-context callers), the row must belong to that band — a band admin's authority stops at their own band…

`memberScope(memberId, bandId)` generalizes to `memberScope(memberId, groupId?)`, keeping the staff-omits-scope escape hatch. Every service function taking a client-supplied child id follows the same shape.

**`allowStaff` settles a live inconsistency.** `requireBandMember()` throws 403 for staff who are not members, while `getBandLayout` lets them in and reports `userRole: 'staff'` — so a staff member can currently render a band panel in which every single action fails. The layout and the guard must use the same rule; `allowStaff: true` is that rule, applied to reads and withheld from destructive writes.

`getUserRole` continues to filter on `status = 'active'`, so a pending invitee gets 403. That is correct, and it means `acceptInvitation` cannot be guarded by `requireGroupRole` — it stays guarded by `requireUser()` plus row ownership in the WHERE clause, as it is today.

---

## Workflows

### The Real Book Club, end to end

The driving case, traced through the design, as a check that the pieces actually compose:

The driving case, traced through the design, as a check that the pieces actually compose:

1. **Staff** create the group from `/staff/groups`, kind `club`, named "Real Book Club", and appoint a member as its leader — an owner `group_member` row. It gets the slug `real-book-club` and a public page at `/groups/real-book-club`. No band profile.
2. Staff set `joinPolicy: 'open'`. The leader writes `joinInstructions` — "third Thursday, bring a horn, charts provided" — which the public page shows next to a Join button.
3. Anyone browsing `/groups/real-book-club` who is signed in can join themselves, landing straight on an active `member` row. The leader can still invite people directly, and non-members get a `group_invite` email.
4. The leader creates a recurring event series for the jam, `source: 'group'`, and asks it to hold the room. Each occurrence is published to the gig guide with the club as host and carries a free `bookerType: 'event'` reservation — see [Room time](#room-time). No credits are spent and nobody books anything personally.
5. They upload the charts to Documents as PDFs. Members download them through the authorized route; nobody outside the club can, which matters for material the club doesn't own outright.
6. A session moves. They post an announcement; it fans out in-app and by email to every member who hasn't muted the club, in one batched send.

Two pieces of this do not exist yet and are the real work: a `createGroupEvent()` that can reserve the room, and a fix to the recurring generator, which hard-codes `source: 'cmc'` and `status: 'draft'` and would otherwise emit unpublished CMC-attributed drafts with no reservation. See [Prerequisites](#prerequisites-and-known-defects).

### Creating a group

**Bands** are member self-service, unchanged from today: a member enters a name, and the service creates the `group` (slug generated and checked against `RESERVED_SLUGS`), the owner `group_member` row, and a linked `band_profile` with its identity columns NULL — one `db.batch`. Redirect to `/band/{slug}`.

**Clubs and committees** are created by staff from `/staff/groups`:

1. Staff enter a name, kind, and description, and pick the member who will lead it.
2. The service creates the `group` and an owner `group_member` row for that member with `status = 'active'` — appointed, not invited, so there is nothing for them to accept.
3. Staff set `joinPolicy` and `publicVisibility`.
4. The appointee gets a notification and the group appears in their panel switcher.

The appointee never had to opt in, which is deliberate: staff are recording an arrangement that already exists offline. They can leave or hand off afterwards like any owner.

### Joining an open group

1. A signed-in member opens the public page of a group with `joinPolicy: 'open'` and clicks Join.
2. The service inserts a `group_member` row with `role = 'member'`, `status = 'active'`, `invitedById = null`.
3. They land in the panel immediately — no approval, no pending state.

The guard is the group's own policy, not the caller's identity: the remote re-reads `joinPolicy` from the resolved group rather than trusting anything from the request. Re-joining is idempotent against `unique(groupId, userId)`. Leaving and rejoining is unremarkable and expected for a drop-in program.

Owners and admins cannot self-assign — self-join always produces `role = 'member'`.

### Inviting a member

1. Owner or admin opens Members, searches CMC members by name or email.
2. Picks a role and optionally a position.
3. Existing user → `group_member` row with `status = 'pending'`; the invitee sees it on their dashboard.
4. No account → `group_invite` row with a token and a 7-day expiry, and an emailed link.

At signup, `resolvePendingInvites(userId, email)` converts pending invites into active memberships. The real FK means an invite to a deleted group has already cascaded away, so there is no dangling-reference case to handle.

### Posting an announcement

1. Owner or admin writes a title and a markdown body, then publishes.
2. The row is written with `publishedAt` set and `notifiedAt` NULL, and `announcement.published` is emitted.
3. A listener fans out to members — see [Notifications](#notifications).
4. Members see it on the group dashboard and, unless muted, in-app and by email.

Announcements are one-way. Replies, threads, and read receipts are [deferred](#deferred).

### Uploading a document

1. Owner or admin uploads a file from the group's Documents page.
2. The service validates type and size, checks the group's quota, writes to the **private** bucket, and records a `file` row.
3. Any active member can download it through the authorized route. Nobody outside the group can, at any URL.

### Claiming a touring act

The path from staff-kept record to member band:

1. Staff have a `band_profile` with `groupId = null`, holding the act's name, description, avatar, genres, and links.
2. Someone from the act joins CMC and claims it.
3. The service creates a `group` (kind `band`), **moves** name/description/avatar from the profile onto the group, **nulls** the profile's copies, sets `band_profile.groupId`, and creates the owner `group_member` row — one `db.batch`.
4. The band now has a slug and is publicly addressable. Its entire prior history — every event it played — is already attached.

Nothing merges and no rows are reconciled, which is what the earlier "external acts are just band rows" design was trying to avoid.

### Transferring ownership, leaving, removing

Unchanged from bands, minus the `ownerId` write: the target's row becomes `owner`, the previous owner's becomes `admin`, in one batch. An owner cannot be removed or leave without transferring first.

For a club or committee, staff may also reassign the leader directly from the staff panel without the outgoing leader's participation — the appointment is theirs to make and unmake.

### Resigning a leadership

**A program leader may leave without naming a successor.** They step down, their `group_member` row is deleted, the owner seat goes empty, and staff are notified and see the group flagged in `/staff/groups`.

This is the one place programs and bands diverge on leaving. A band owner must transfer first, because there is nobody whose job it is to pick up an orphaned band. A program leader was **appointed**, and the body that appointed them is still there — so "must find your own replacement" would be trapping someone in a volunteer role they have already said they are done with. The group keeps running in the meantime; nothing about it depends on the owner row existing.

Ordinary members leaving is unremarkable under either policy, and under `open` they may rejoin whenever they like.

### Ending a group

**Deactivation is how a program ends. Hard deletion is for mistakes.** These are two different operations and the UI should not present them as a pair of equally weighted buttons.

A dissolved committee is a historical fact, and its minutes, roster, and announcements _are_ the record of it. Cascading them away because the committee wound up is the wrong default — the group ending is exactly when its documents become archival rather than operational. `deactivate()` / `reactivate()` already exist for bands (`band-service.ts:570`, `:599`) and generalize unchanged.

**Deactivating** sets `deletedAt`. The group leaves the public directory and the panel switcher, its events stop generating, and the panel goes read-only — but every row survives, staff can still reach it and its documents from `/staff/groups`, and reactivating restores a working group. No R2 object is touched. Retention is indefinite; a wound-up committee's minutes are a few megabytes and the storage argument does not outweigh losing them.

**Hard deletion** is a staff-only action reserved for rows that should never have existed — a typo'd name, a duplicate, a test. It confirms with an explicit count ("this will permanently delete 14 documents and 62 announcements"), then:

1. Private R2 objects for the group's files are deleted first — a failed object delete leaves the rows as a recovery record rather than orphaning storage silently.
2. The `group` row is deleted. `group_member`, `group_invite`, `announcement`, and `file` **cascade**.
3. A linked `band_profile` survives with `groupId` set to null, and its identity columns are repopulated from the group before deletion — a deleted band reverts to a staff-kept record rather than vanishing, so its event history keeps a name.

A band owner deleting their own band from Settings keeps today's behavior: it is their project and their call, and the confirmation carries the same document count.

The alternative designs were rejected as more machinery than the problem needs: reassigning orphaned files to an archive group needs a synthetic group and an `archivedFrom` column; blocking deletion until documents are cleared just makes staff delete them manually first, which is the outcome deactivation avoids entirely.

---

## Routes

### Band panel (`/band/{slug}`)

Unchanged root, now resolving a **group** slug. Nav splits into two sections so the presentational and managerial halves stop competing for one flat list:

| Section         | Route                          | Page                                       | Access       |
| --------------- | ------------------------------ | ------------------------------------------ | ------------ |
| —               | `/band/{slug}`                 | Dashboard                                  | all members  |
| **Public face** | `/band/{slug}/edit`            | Band profile — tagline, genres, links, bio | owner, admin |
| **Public face** | `/band/{slug}/page-editor`     | Premium microsite blocks & theme           | owner, admin |
| **Public face** | `/band/{slug}/page-editor/epk` | EPK                                        | owner, admin |
| **Public face** | `/band/{slug}/subscription`    | Premium tier                               | owner        |
| **Manage**      | `/band/{slug}/members`         | Roster, invitations, roles                 | all members  |
| **Manage**      | `/band/{slug}/announcements`   | Announcement list & composer               | all members  |
| **Manage**      | `/band/{slug}/documents`       | Shared files                               | all members  |
| **Manage**      | `/band/{slug}/events`          | Band events                                | all members  |
| **Manage**      | `/band/{slug}/reservations`    | Practice bookings                          | all members  |
| **Manage**      | `/band/{slug}/settings`        | Delete band, danger zone                   | owner        |

### Group panel (`/group/{slug}`)

The same two-section shape for clubs and committees. Its _Public face_ is one page — the simple public page — and it has no reservations:

| Section         | Route                         | Page                                                    |
| --------------- | ----------------------------- | ------------------------------------------------------- |
| —               | `/group/{slug}`               | Dashboard                                               |
| **Public face** | `/group/{slug}/edit`          | Name, description, photo, visibility, join instructions |
| **Manage**      | `/group/{slug}/members`       | Roster, invitations, roles                              |
| **Manage**      | `/group/{slug}/announcements` | Announcement list & composer                            |
| **Manage**      | `/group/{slug}/documents`     | Shared files                                            |
| **Manage**      | `/group/{slug}/events`        | Group sessions, including the recurring series          |
| **Manage**      | `/group/{slug}/settings`      | Leave, hand off — **no delete**                         |

There is no danger zone here. Ending a club or committee is a staff action, so `/group/{slug}/settings` carries leaving and handing off but not deletion.

### Public

| Route                     | Page                                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `/groups`                 | Directory of public groups, filterable by kind                                                                                   |
| `/groups/{slug}`          | Simple public page — name, description, photo, upcoming sessions, and a Join button when `joinPolicy` is `open`                  |
| `/directory/bands/{slug}` | Band profile — unchanged, now resolving through the group                                                                        |
| `/act/{token}`            | Token-gated contact sheet for an unclaimed act to fill in its own details. A **write** surface — no readable profile page exists |

The Join button is the only write on a public page. It requires a session, so a signed-out visitor gets a sign-in prompt that returns them to the group.

Groups get **no subdomains**. Only band microsites claim `{slug}.corvmc.org`, so `hooks.ts` is untouched. Group slugs still need reserved-checking, because they share one namespace with bands.

`RESERVED_SLUGS` currently holds `band`, `bands`, `member`, `members`, `events`, `directory` — and none of `group`, `groups`, `club`, `clubs`, `class`, `classes`, `committee`, `committees`, `file`, `files`. These must be added **before the first group is created**; retrofitting means renaming live slugs.

Reserve `class` and `classes` now even though classes are deferred. Reserving a word costs nothing today and cannot be done later without taking a slug away from a group that already has it.

### Staff

| Route                | Page                                                                           |
| -------------------- | ------------------------------------------------------------------------------ |
| `/staff/groups`      | All clubs and committees; **create** a group and appoint its leader            |
| `/staff/groups/{id}` | Edit, set `joinPolicy` and visibility, reassign the leader, deactivate, delete |
| `/staff/bands`       | Existing page — gains a filter for unlinked touring profiles                   |

`/staff/groups` is the **only** place a club or committee comes into existence. Touring profiles have no panel, no slug, and no page of their own; they are reached from the staff bands area, which gains an inline create used when booking an act into a production and a "send contact sheet link" action.

Add `act` and `acts` to `RESERVED_SLUGS` alongside the group words, so no group can claim the contact-sheet root as a subdomain.

### API

| Route             | Method   | Purpose                                 |
| ----------------- | -------- | --------------------------------------- |
| `/api/files/[id]` | `GET`    | Authorized private download — see below |
| `/api/files/[id]` | `DELETE` | Remove a document (owner, admin)        |

### Panel switcher

`AppTopbar.svelte` currently partitions panels with `p.type !== 'band'`, which would push every group into the top-level button row and blow out the topbar. `PanelTab['type']` widens to include `'group'`, the predicate becomes an explicit `'member' | 'staff'` test, and bands and groups share **one** "My groups" dropdown with sections.

`getMemberLayout`, `getStaffLayout`, and `getBandLayout` all three build this list from `listForUser`. Extract one `getPanels(userId)` rather than letting a fourth copy diverge.

---

## Notifications

One notification type covers every kind:

```
key         'announcement'
label       'Group announcements'
description 'Posts from bands, clubs, and committees you belong to'
defaults    { email: true, inApp: true, sms: false }
```

Per-kind keys (`band_announcement`, `club_announcement`, …) were rejected: they would put four near-identical rows in the preferences UI for one user decision, create a `notification_preference` row per user per kind, and make adding a kind a registry change plus a UI change. The kind goes in the notification `data` payload and the copy.

Per-group muting is `group_member.notifyAnnouncements`, which the global preference cannot express.

### Fan-out

The send runs in a listener registered inside `registerNotificationListeners()`, not inline in the remote function. The remote writes the row, emits, and returns.

**`dispatch()` in a loop does not work at group scale.** Per recipient it performs a preference SELECT, a notification INSERT, an in-memory SSE push, and one outbound HTTPS call to Postmark — all awaited serially. At 200 members that is roughly 600 sequential subrequests against a 1000-subrequest ceiling, tens of seconds of wall clock, and a mid-loop failure that leaves half the group notified with no record of where it stopped.

The listener instead:

1. **Latches.** `UPDATE announcement SET notified_at = ? WHERE id = ? AND notified_at IS NULL RETURNING id`. No row back means another invocation already sent; return. This is the idempotency the house rule requires of every event-bus side effect.
2. **Resolves recipients in one query.** `group_member ⋈ user LEFT JOIN notification_preference`, excluding the author, muted memberships, and soft-deleted users. Null preferences coalesce to the type's defaults in JS, mirroring `getPreference`.
3. **Inserts in-app rows in chunks.** D1 caps a statement at **100 bound parameters**, so a naive 200-row multi-column insert is rejected outright. Chunk, then group the statements into `db.batch([...])` — never `db.transaction()`, which the `custom/no-db-transaction` lint rule bans because it is broken on D1.
4. **Sends one batched email per 500 recipients** through a new `sendTemplateBatch()` alongside the existing `sendBroadcastBatch()`, on the transactional stream.
5. **Records `recipientCount`.**

That turns 200 emails into one subrequest and 200 inserts into roughly 20 statements across 2 batches.

Above ~500 recipients the listener persists a cursor and lets the existing cron drain it, so the failure mode at unexpected scale is a slow send rather than a truncated one. Real CMC groups are far below this; the rule exists so the ceiling is defined rather than discovered.

No new Postmark template is needed — the generic `notification` template is model-driven.

---

## Documents and private storage

**Documents is a file store, not a document tool.** Members upload files produced elsewhere — charts as PDFs, committee minutes from whatever word processor the committee already uses — and download them again. There is no in-app authoring, no rich-text editor, no versioning, and no structured minutes or agenda format. That boundary is what keeps this a small feature, and it is a decision rather than an omission.

### This requires a second bucket

`media.corvmc.org` is an **R2 bucket custom domain**. There is no prefix scoping and no per-object ACL: attaching a custom domain makes the entire keyspace publicly readable, and existing keys are guessable (`bands/avatars/{bandId}.jpg`). A private document placed in the `corvmc` bucket would be one guessed URL away from public, and nothing in the app would report it.

`resolveImageUrl()` and `getPublicUrl()` compound this — they will mint a `media.corvmc.org` URL for _any_ key handed to them. (The transform half of this is fixed: `getPublicUrl` now only wraps keys whose extension is an image format, so a PDF resolves to a plain R2 URL rather than a meaningless transformation. Keys also carry a random token now, so they are no longer guessable from an entity id. Neither changes the core problem below — the object is still public.)

So:

- A new bucket `corvmc-private`, binding `R2_PRIVATE`, **no custom domain and no public access**. `wrangler.toml` gains a second `[[r2_buckets]]`; `hooks.server.ts` gains `initPrivateStorage(...)`; the env validation gains the binding.
- A new `src/lib/server/private-storage.ts` that **exports no URL-minting function at all**. The module boundary is the guardrail: there is no `getPublicUrl` in scope to call by accident.
- `file.key` must never reach `resolveImageUrl`.

### The download route

`src/routes/api/files/[id=uuid]/+server.ts`, reusing the existing `uuid` param matcher. It resolves the row, then authorizes against **the file's own group** — never against anything supplied by the request — with `requireGroupRole({ id: row.groupId }, 'member', { allowStaff: true })`.

Three response requirements, all load-bearing. Unlike avatars and posters, which sit on a separate media origin, private files are served **from the app origin with session cookies attached**:

- **Stream `obj.body` straight into `Response`.** Never `await obj.arrayBuffer()` — that buffers the whole file into a 128 MB isolate and burns CPU proportional to size.
- **`Cache-Control: private, no-store` plus `Vary: Cookie`.** Without it Cloudflare's edge can cache one member's authorized response and serve it to the next requester.
- **`Content-Disposition: attachment` plus `X-Content-Type-Options: nosniff`**, with CR/LF and quotes stripped from the filename. Serving a user-uploaded `text/html` inline would be stored XSS against `corvmc.org`.

### Limits

Allowed types are a constant in `private-storage.ts`, **not** a change to `storage.ts`'s `ALLOWED_TYPES`, which also governs avatars:

```
application/pdf
image/jpeg, image/png, image/webp
text/plain, text/csv
application/vnd.openxmlformats-officedocument.wordprocessingml.document   (.docx)
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet         (.xlsx)
```

Legacy macro formats (`application/msword`, `application/vnd.ms-excel`), `application/zip`, and `application/octet-stream` are excluded.

`uploadFile()` enforces its 10 MB cap regardless of the `allowedTypes` argument it is given, and 10 MB is small for a real document. The private module carries its own `MAX_DOCUMENT_BYTES` of 25 MB rather than raising the shared constant. That is a hard ceiling: the file passes through `request.formData()` into an `ArrayBuffer` in the Worker, so memory is the real limit. Anything larger needs presigned multipart upload, which is [deferred](#deferred).

Quota is `sum(sizeBytes)` for the group where `deletedAt IS NULL`, checked before upload — 250 MB and 50 files per group, as service constants rather than per-group columns until someone asks for tiering.

Soft-deleting a document **hard-deletes the R2 object immediately**; the row is the audit record. A soft-delete flag with no reaper is how storage bills grow silently.

`File.type` is browser-supplied and spoofable, and there is no virus scanning. The exposure is bounded — authenticated members only, forced attachment, `nosniff` — but it is a real trade-off and is stated rather than left implicit.

---

## Service surface

New: `src/lib/server/group/`.

| Function                                                                 | Description                                                                                                                                           |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create(ownerId, { kind, name, description })`                           | Group + owner row (+ band profile when kind is `band`), one batch. Callers gate on kind: `band` is member self-service, `club`/`committee` staff-only |
| `update(groupId, data)`                                                  | Name/description/visibility/`joinPolicy`; re-slug on rename, excluding self                                                                           |
| `joinGroup(groupId, userId)`                                             | Self-join. Re-reads `joinPolicy` from the resolved group; always `role: 'member'`, `status: 'active'`                                                 |
| `assignLeader(groupId, userId, actorId)`                                 | Staff appointment: owner row created or moved without the outgoing owner's participation                                                              |
| `deactivate(groupId)` / `reactivate(groupId)`                            | The normal end-of-life. Sets/clears `deletedAt`; no rows removed, no R2 objects touched                                                               |
| `deleteGroup(groupId, actorId)`                                          | Hard delete for mistakes only. Delete private objects, restore profile identity, delete group (cascades)                                              |
| `getBySlug(slug)` / `getById(id)`                                        | Excludes soft-deleted; includes member count                                                                                                          |
| `listForUser(userId)`                                                    | Groups where the user has a row, any status                                                                                                           |
| `getMembers(groupId)`                                                    | Rows joined to user, ordered owner → admin → member                                                                                                   |
| `invite` / `acceptInvitation` / `declineInvitation` / `revokeInvitation` | Unchanged semantics, group-scoped                                                                                                                     |
| `removeMember` / `updateMember`                                          | Client ids re-scoped via `memberScope`                                                                                                                |
| `transferOwnership` / `leaveGroup`                                       | Owner constraints as today, minus the `ownerId` write                                                                                                 |
| `claimBandProfile(profileId, ownerId)`                                   | The touring-act claim described above                                                                                                                 |

`announcement-service.ts`, `file-service.ts`, and `group-context.ts` sit alongside it. `band-service.ts` shrinks to band-profile concerns: tier, subscription, genres, links, and the microsite.

`requireBandMember` / `requireBandAdmin` / `requireBandOwner` remain for one release as thin deprecated wrappers delegating to `requireGroupRole`, so the schema work and the 55-call-site port land in separate reviewable PRs.

---

## Feature flags and rollout

Four flags: `groups`, `groupEvents`, `groupFiles`, `announcements`. The last two cover bands as well as groups, since both capabilities key off group membership and bands are groups.

A flag must be registered in **three** places — the `FeatureFlag` union, `ALL_FLAGS`, and `DEFAULTS` in `site-config-service.ts`. Missing the third makes `config()` _throw_ `Unknown site config key`, not return false.

Phase order. Each phase ships green, with bands working at every step.

| #   | Phase                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------- |
| 0   | Reserved slugs. First, and near-irreversible once groups exist                                          |
| 1   | `group` + `group_member`; create a group per existing band, moving name/slug/avatar/description onto it |
| 2   | Port every `band_member` read and write to `group_member` — **its own PR**                              |
| 3   | `band` → `band_profile`: drop slug, name, `ownerId`, the name unique, and the redundant columns         |
| 4   | `requireGroupRole` + explicit refs; deprecated wrappers retained                                        |
| 5   | `/staff/groups` + `/group/{slug}` panel + public group page; `joinPolicy` and self-join                 |
| 6   | `group_invite` replaces `platform_invite`                                                               |
| 7   | Announcements — bands and groups simultaneously, since it is the same code                              |
| 8   | Documents — bucket and binding deployed and verified **first**, then the table and route                |
| 9   | Group events + `event_group` + `createGroupEvent()`; fix the recurring generator                        |

Do not interleave phases 1–3. A half-ported roster plus a new `group` table means group bugs and band regressions land in one diff and cannot be told apart.

Phase 2 carries a specific hazard: `band-service.ts` contains **three raw-SQL `band_member` subqueries** (around lines 200, 521, and 559) that `pnpm check` cannot see inside. They compile fine through the port and throw at runtime the moment the table is dropped. Add a CI grep gate on the literal string as part of that PR.

---

## What changes

| Area           | Change                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| Database       | `group`, `group_member`, `group_invite`, `announcement`, `file`, `event_group`; `band` → `band_profile` |
| Slugs          | Move to `group` and become the only slugs in the system                                                 |
| Ownership      | `band.ownerId` dropped; the owner is a `group_member` row                                               |
| Permissions    | `band-context.ts` → `requireGroupRole` with explicit refs                                               |
| Events         | `event.bandId` → `event.groupId`; `source` gains `'group'`; `event_group` for co-billing                |
| Group events   | New `createGroupEvent()` that can reserve the room free via `bookerType: 'event'`                       |
| Reservations   | `bookerId` for `bookerType = 'band'` repoints to `group.id`. No new `bookerType` value                  |
| Enrollment     | `joinPolicy` on `group`; self-join for `open` groups                                                    |
| Staff panel    | New `/staff/groups` — the only place a club or committee is created                                     |
| Contact sheets | `band_profile_link` + `/act/{token}` — a magic-linked write surface, no readable act page               |
| Attribution    | Public mentions of an unclaimed act link **out** to the act's own URL, or render as plain text          |
| Storage        | Second R2 bucket for private documents                                                                  |
| Email          | `sendTemplateBatch()` added to the Postmark client                                                      |
| Notifications  | One `announcement` type; per-group mute on the membership row                                           |
| Nav            | Band panel splits into Public face / Manage; topbar gains a merged groups dropdown                      |

## What doesn't change

| Area                   | Notes                                                                             |
| ---------------------- | --------------------------------------------------------------------------------- |
| Auth / session         | No changes                                                                        |
| Platform roles         | `admin` / `staff` / `sustaining` / `member` untouched; group roles are orthogonal |
| Reservation flow       | Booking, conflicts, credits, payment all unchanged                                |
| Band microsite         | Blocks, themes, EPK, custom CSS all unchanged; they re-key to `band_profile`      |
| Staff inbox            | Untouched — it models external contacts, not member sets                          |
| `production_slot`      | Run-of-show modeling stays entirely with productions                              |
| Recurring reservations | The generator's reservation branch is not extended to groups                      |

---

## Prerequisites and known defects

Verified against the code, and load-bearing for this design whether or not they are fixed in the same pass.

| Finding                                                                                                                                                                | Location                           | Effect                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `opts.includeBandEvents ? undefined : eq(event.source, 'cmc')` — the filter vanishes when true                                                                         | `event-service.ts:789, :814`       | Group events would leak onto the public calendar regardless of the flag, and band events cannot be enabled independently. Replace the boolean with a `sources: EventSource[]` allow-list.                    |
| `processEventSeries()` hard-codes `source: 'cmc'` and `status: 'draft'`, copying neither owner nor `location`, and creates no reservation unless the prototype had one | `generation-job.ts:465`            | A club's recurring jazz night would never reach the gig guide **and** would not hold the room. Latent today only because band events cannot be recurring at all.                                             |
| `createBandEvent()` creates no reservation at all — it is an off-site gig listing                                                                                      | `event-service.ts:571`             | There is no non-staff path that reserves the room, so `createGroupEvent()` must add one, modelled on `create()` at `event-service.ts:113` including the `hasConflict` pre-check and the compensating delete. |
| `invite()` catches `err.message.includes('unique')` against D1's `UNIQUE constraint failed`                                                                            | `band-service.ts:317`              | `BandMemberExistsError` never fires; a duplicate invite surfaces as a 500. `platform-invite-service.ts:153` gets the case right.                                                                             |
| `invitedById` declared `.notNull()` **and** `onDelete: 'set null'`                                                                                                     | `platform-invite.ts:25`            | Deleting a user who ever sent an invite fails on a NOT NULL violation. Fixed by the new table.                                                                                                               |
| `createBandEventForm` declares `slug` in Zod, then ignores it for `params.slug`                                                                                        | `band-events.remote.ts:96`         | Two sources of truth for one value. Resolved by the explicit-ref refactor.                                                                                                                                   |
| Three raw-SQL `band_member` subqueries                                                                                                                                 | `band-service.ts` ~200, ~521, ~559 | Invisible to `pnpm check`; throw at runtime after the table is dropped. Needs a CI grep gate.                                                                                                                |

**A decision this spec must make, not defer:** whether `processEventSeries()` copies `status` from the prototype. Doing so is required for a club series to publish automatically, but it changes behavior for existing staff CMC series, which today always generate drafts for review. Publish automatically only when `source !== 'cmc'`, preserving the staff review step where it already exists.

---

## Deferred

- **Classes.** A class looks like a group — a teacher, some students, a roster — but the resemblance stops at the roster. Enrollment is not membership: it has a **term** with a start and an end, so the same person is enrolled in Spring and not in Summer while the class itself persists; it has **attendance** per session; and it has **completion**, which is a per-person outcome a membership row has nowhere to put. Modeling that as `group_member` would mean either a new group per term (losing the class's identity and history) or status values that quietly mean different things depending on kind.

  The shape when it lands: **`class` is its own kind**, added to the union alongside `club` — not a flavour of club and not a rename of one. A `class` module then hangs off it holding `term` and `enrollment`, the same relationship `band_profile` has to `group`, while roster, announcements, and documents are reused wholesale. Nothing in this spec forecloses that; adding the kind is one line plus a row in the governance table above. This is also where the reserved `'lesson'` value already sitting in `reservation.bookerType` would finally get used.

  This is why `club` keeps its concrete name rather than a broader one like `program`. A single umbrella kind would have to be subdivided the moment classes arrive, and subdividing an enum after rows exist is a data migration; separate kinds from the start cost nothing.

- **Threaded discussion** — replies to announcements, read receipts, unread counts. `sse.ts` is a per-isolate in-memory registry, adequate for a bell badge but not a real-time transport; group chat would want a Durable Object.
- **Group email aliases** — an inbound address per group fanning out to members. The inbound plumbing exists (Postmark `MailboxHash`, signed reply addresses) but a real mailing list is deliverability work, and the inbox schema is contact-keyed rather than member-keyed.
- **Document folders, versioning, and previews** — flat list, one version, download only.
- **Presigned multipart upload** — needed above the 25 MB in-Worker ceiling.
- **Group rehearsal bookings** — a group holding the room privately, outside an event, against a credit balance. This is the band-rehearsal shape and would need a `bookerType` value and credit accounting. Programs do not need it: their sessions are events, and events reserve the room free — see [Room time](#room-time). An earlier draft listed this as a blocking gap for the Real Book Club, which was wrong; the jam is an event and gets its room that way.

- **Request-to-join.** `joinPolicy` has two values, not three. Approval-gated joining needs a `status: 'requested'` rather than reusing `'pending'` — today `'pending'` means "we invited you, awaiting your answer," and a join request is the exact mirror, "you asked us, awaiting ours." Overloading one value would make every roster query and every notification ambiguous about which direction it was facing. It also needs an approval queue and its own notification type, which is more surface than anyone has asked for.
- **Self-service contact sheets for member bands.** `/act/{token}` exists because an unclaimed act has no account. A member band edits its profile in its own panel, so it needs nothing here.
- **Group subdomains** — only band microsites claim one.
- **Public group directory filtering** beyond kind — no genre or tag search for non-band groups.
- **Per-group document quota tiers** — service constants for now.
- **Self-serve joining** — `joinInstructions` is prose; there is no request-to-join flow, and every membership starts with an invitation.

## Decisions that were open

Recorded because each one shaped something above, and because the reasoning is easier to revisit than to reconstruct.

- **A committee needs nothing a club doesn't.** Both are the same shape. Minutes are **uploaded** from whatever word processor the committee already uses, not authored in the app — so they are ordinary documents and there is no minutes editor, no decision log, and no structured agenda. This is the clearest statement of what Documents is: a **file store**, not a document tool. Anything that would need in-app authoring is out of scope by construction.
- **A program leader may resign without a successor.** The owner seat goes empty and staff reappoint. See [Resigning a leadership](#resigning-a-leadership).
- **Touring profiles get no page at all — not even an unlisted one.** A hosted page is a **member benefit**: it is what joining CMC buys, alongside the slug, the directory listing, and the microsite. An unclaimed act already has the web presence it chose, so public attribution links **out** to that, or renders as plain text. The one URL they get is `/act/{token}`, a magic-linked form for filling in their own record — a write surface, not a page. See [An unclaimed act has no page anywhere](#an-unclaimed-act-has-no-page-anywhere).

  Two earlier drafts overshot this. The first gave staff a UUID path; the second added a `publicId` and an unlisted `/a/{publicId}` profile so staff could forward an act's record to a promoter. Both were answering "how do we address this record publicly" when the right answer is that we don't. A promoter wants the band's own links, and hosting our copy of a third party's information means owning its accuracy and its exposure for no benefit. [Sqids](https://sqids.org/) were considered for the short id and were doubly wrong — they encode integers, which this schema has none of on `band_profile`; the implicit `rowid` alternative is unstable across the D1 table rebuild in phase 3; and their own docs list _sensitive data_ and _user IDs_ under "not good for," since the encoding is reversible against a shuffled alphabet rather than a secret.

- **Documents survive the group.** Deactivation, not deletion, is how a program ends; see [Ending a group](#ending-a-group).
- **Bands stay member self-service.** A band is a member's own project; a club or committee is an institution CMC stands behind. Any member may create a band, exactly as today, and the existing Create Band flow is unchanged. Only clubs and committees are staff-created — which is what makes free room time safe to grant by kind, since the privilege attaches to the thing members cannot mint for themselves.
- **One slug namespace for every kind, not one per kind.** `group.slug` is `unique(slug)`, not `unique(kind, slug)`. Splitting it would work — the route roots are already disjoint (`/band/{slug}` and `/group/{slug}`), and only bands claim subdomains — and it would let a band and a club both be "Jazz Night" instead of one becoming `jazz-night-2`.

  It was rejected on three counts. **The guard is the decisive one:** `requireGroupRole({ slug })` resolves a group from a slug alone, and it is called at ~55 sites; a per-kind namespace makes the ref `{ kind, slug }`, so the security boundary takes two client-supplied values instead of one and every caller has to know the kind before it can resolve anything. **Kind stops being free metadata** — `unique(kind, slug)` means changing a group's kind can collide, so it gains a uniqueness check on update. **And kind has to travel everywhere slug travels**: the panel switcher, search results, an announcement's source, a notification's `href`. That is a lot of plumbing to buy a collision case that is arguably worth preventing anyway, since two groups sharing a name confuses people regardless of what the URLs do.

  The reversibility is also asymmetric. Shared → split is easy later: nothing collides, you relax the index. Split → shared means resolving collisions that already exist and breaking live URLs. Name squatting — a member taking a slug a future program wants — is handled by `RESERVED_SLUGS`, which staff can pre-claim, plus a rename.

## Open questions

None — all decisions have been made.

## What this does not cover

- The CMC production workflow — venues, run of show, settlement. That is [production-workflow-spec.md](production-workflow-spec.md); this spec only redefines the band/group boundary it depends on.
- Event creation, ticketing, and the public gig guide, beyond the ownership column and the source allow-list.
- The staff inbox, marketing campaigns, and platform-wide notification preferences.
- **Authoring documents in the app.** Documents stores files; it does not create or edit them. Minutes, agendas, and charts are made elsewhere and uploaded.
- Migration mechanics for D1 table rebuilds — see [conventions](../development/conventions.md#table-rebuilds-on-d1).
