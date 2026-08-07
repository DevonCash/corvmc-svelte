# Groups Module

A group is a set of CMC members who organize together — a band, a club, a class, or a committee. Groups own a roster, post announcements to their members, keep shared documents, and run events. A band additionally has a **band profile**: the public-facing musical identity (genres, hometown, links, EPK, premium microsite) that a club or committee has no use for.

This spec splits today's `band` table in two. `group` is the managed organization; `band_profile` is the band's presentational data. The split is what lets clubs, classes, and committees reuse the roster machinery without inheriting band-shaped columns — and what lets a touring act exist as a staff-kept record with no roster at all.

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

Four kinds of group, and the kind is presentation and filtering only — it grants no capability by itself:

```
group.kind  'band' | 'club' | 'class' | 'committee'
```

Only a `band` group may have a band profile. Everything else about a group — roster, roles, announcements, documents, events — behaves identically across all four kinds. **Kind is not a permission.** A club can run events exactly as a band can; the only thing kind gates is whether the band-profile surfaces appear.

### Group

```
group
  id                 text (uuid), PK
  kind               text, not null   ('band' | 'club' | 'class' | 'committee')
  name               text, not null
  slug               text, not null, unique
  description        text, nullable
  avatarKey          text, nullable   (R2 storage key)
  publicVisibility   text, not null, default 'public'   ('public' | 'members' | 'hidden')
  joinInstructions   text, nullable
  lookingForMembers  boolean, not null, default false
  contact            json, nullable   (public contact preferences)
  createdAt          timestamp, not null
  updatedAt          timestamp, not null
  deletedAt          timestamp, nullable
```

**Slugs live here and nowhere else.** `group.slug` is the only slug in the system, so a plain unique index is the whole namespace enforcement — no registry table, no dual-write, no second source of truth. It follows that **a thing is publicly addressable if and only if it has a group**, which is a structural fact rather than a filter anyone can forget to apply.

**There is no `ownerId`.** The owner is the `group_member` row with `role = 'owner'`, enforced by a partial unique index. See [Ownership](#ownership).

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
- `position` is free text and carries whatever the group calls it — instrument for a band, office for a committee, role for a class.
- `notifyAnnouncements` is the per-group mute. A member of six groups needs to silence one without silencing all; a single global preference cannot express that.

**Membership is not polymorphic.** Because everything managed is a group, `groupId` is a real foreign key with `ON DELETE CASCADE` — as are `group_invite`, `announcement`, and `file`. This is the single largest simplification in the design. A polymorphic `(entityType, entityId)` shape would have required a `purgeEntity()` helper called from every delete path, an orphan-reconcile cron, and a discriminator branch in every query. It would also have invited the bug `content_flag` already has: its rows are never cleaned up when a band is deleted, because there is no FK to enforce it.

### Ownership

Every group has exactly one owner: the `group_member` row with `role = 'owner'`, guaranteed by `unique(groupId) where role = 'owner'`.

This spec drops `band.ownerId` rather than carrying it across. Authorization never reads it today — `requireBandOwner()` resolves through `getUserRole()`, which reads `band_member` alone — so every remaining use is display or bookkeeping, and all of it is derivable. `transferOwnership()` already performs its three writes in a single `db.batch([...])`; dropping the column removes one statement from a batch that already spans the other two, so the atomicity guarantee is unchanged.

Dropping it also retires a live contradiction. The migration declares `owner_id text NOT NULL` with `FOREIGN KEY ... ON DELETE SET NULL` — two clauses that cannot both be satisfied, so deleting a user who owns a band would fail at the constraint. The Drizzle definition says `onDelete: 'restrict'`, so schema and migration disagree about the intent as well. `purgeUser()` guards it in application code, which is why nobody has hit it.

**A group with zero members is legal**, and it is how an unclaimed touring act is represented once it has a group. The owner row is created at the same time as the group in every user-facing path; only staff can create a member-less one.

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

---

## Roles and permissions

Three roles within a group, checked at the service level. Identical across all four kinds.

| Role   | Post announcements | Upload documents | Invite | Remove members | Edit group | Manage events | Delete group | Transfer ownership |
| ------ | ------------------ | ---------------- | ------ | -------------- | ---------- | ------------- | ------------ | ------------------ |
| owner  | ✅                 | ✅               | ✅     | ✅             | ✅         | ✅            | ✅           | ✅                 |
| admin  | ✅                 | ✅               | ✅     | ✅ (not owner) | ✅         | ✅            | ❌           | ❌                 |
| member | ❌                 | ❌               | ❌     | ❌             | ❌         | ❌            | ❌           | ❌                 |

Members read announcements and download documents; they do not create them. Staff (`admin` or `staff`) can manage any group from the staff panel.

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

### Creating a group

1. Member picks a kind and enters a name; description optional.
2. The service creates the `group` (slug generated from the name, checked against `RESERVED_SLUGS`) and a `group_member` row with `role = 'owner'`, `status = 'active'`, in one `db.batch`.
3. If kind is `band`, a linked `band_profile` row is created with its identity columns NULL.
4. Redirect to `/group/{slug}` — or `/band/{slug}` for a band.

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

### Deleting a group

1. Owner confirms from Settings.
2. Private R2 objects for the group's files are deleted first — a failed object delete leaves the rows as a recovery record rather than orphaning storage silently.
3. The `group` row is deleted. `group_member`, `group_invite`, `announcement`, and `file` **cascade**.
4. A linked `band_profile` survives with `groupId` set to null, and its identity columns are repopulated from the group before deletion — a deleted band reverts to a staff-kept record rather than vanishing, so its event history keeps a name.

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
| **Manage**      | `/band/{slug}/settings`        | Delete group, danger zone                  | owner        |

### Group panel (`/group/{slug}`)

The same two-section shape for clubs, classes, and committees. Its _Public face_ is one page — the simple public page — and it has no reservations:

| Section         | Route                         | Page                                                    |
| --------------- | ----------------------------- | ------------------------------------------------------- |
| —               | `/group/{slug}`               | Dashboard                                               |
| **Public face** | `/group/{slug}/edit`          | Name, description, photo, visibility, join instructions |
| **Manage**      | `/group/{slug}/members`       | Roster, invitations, roles                              |
| **Manage**      | `/group/{slug}/announcements` | Announcement list & composer                            |
| **Manage**      | `/group/{slug}/documents`     | Shared files                                            |
| **Manage**      | `/group/{slug}/events`        | Group events                                            |
| **Manage**      | `/group/{slug}/settings`      | Delete group                                            |

### Public

| Route                     | Page                                                                        |
| ------------------------- | --------------------------------------------------------------------------- |
| `/groups`                 | Directory of public groups, filterable by kind                              |
| `/groups/{slug}`          | Simple public page — name, description, photo, upcoming events, how to join |
| `/directory/bands/{slug}` | Band profile — unchanged, now resolving through the group                   |

Groups get **no subdomains**. Only band microsites claim `{slug}.corvmc.org`, so `hooks.ts` is untouched. Group slugs still need reserved-checking, because they share one namespace with bands.

`RESERVED_SLUGS` currently holds `band`, `bands`, `member`, `members`, `events`, `directory` — and none of `group`, `groups`, `club`, `clubs`, `class`, `classes`, `committee`, `committees`, `file`, `files`. These must be added **before the first group is created**; retrofitting means renaming live slugs.

### Staff

Touring profiles have no panel and no public URL. They are reached from the staff bands area, which gains a filter for unlinked profiles and an inline create used when booking an act into a production.

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
description 'Posts from bands, clubs, classes, and committees you belong to'
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

### This requires a second bucket

`media.corvmc.org` is an **R2 bucket custom domain**. There is no prefix scoping and no per-object ACL: attaching a custom domain makes the entire keyspace publicly readable, and existing keys are guessable (`bands/avatars/{bandId}.jpg`). A private document placed in the `corvmc` bucket would be one guessed URL away from public, and nothing in the app would report it.

`resolveImageUrl()` and `getPublicUrl()` compound this — they will mint a `media.corvmc.org` URL for _any_ key handed to them, and route it through `R2_TRANSFORM_URL` with `width=1200,format=webp`, which is meaningless for a PDF.

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

| Function                                                                 | Description                                                               |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `create(ownerId, { kind, name, description })`                           | Group + owner row (+ band profile when kind is `band`), one batch         |
| `update(groupId, data)`                                                  | Name/description/visibility; re-slug on rename, excluding self            |
| `deleteGroup(groupId, actorId)`                                          | Delete private objects, restore profile identity, delete group (cascades) |
| `getBySlug(slug)` / `getById(id)`                                        | Excludes soft-deleted; includes member count                              |
| `listForUser(userId)`                                                    | Groups where the user has a row, any status                               |
| `getMembers(groupId)`                                                    | Rows joined to user, ordered owner → admin → member                       |
| `invite` / `acceptInvitation` / `declineInvitation` / `revokeInvitation` | Unchanged semantics, group-scoped                                         |
| `removeMember` / `updateMember`                                          | Client ids re-scoped via `memberScope`                                    |
| `transferOwnership` / `leaveGroup`                                       | Owner constraints as today, minus the `ownerId` write                     |
| `claimBandProfile(profileId, ownerId)`                                   | The touring-act claim described above                                     |

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
| 5   | `/group/{slug}` panel, group creation, public group page                                                |
| 6   | `group_invite` replaces `platform_invite`                                                               |
| 7   | Announcements — bands and groups simultaneously, since it is the same code                              |
| 8   | Documents — bucket and binding deployed and verified **first**, then the table and route                |
| 9   | Group events + `event_group`                                                                            |

Do not interleave phases 1–3. A half-ported roster plus a new `group` table means group bugs and band regressions land in one diff and cannot be told apart.

Phase 2 carries a specific hazard: `band-service.ts` contains **three raw-SQL `band_member` subqueries** (around lines 200, 521, and 559) that `pnpm check` cannot see inside. They compile fine through the port and throw at runtime the moment the table is dropped. Add a CI grep gate on the literal string as part of that PR.

---

## What changes

| Area          | Change                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| Database      | `group`, `group_member`, `group_invite`, `announcement`, `file`, `event_group`; `band` → `band_profile` |
| Slugs         | Move to `group` and become the only slugs in the system                                                 |
| Ownership     | `band.ownerId` dropped; the owner is a `group_member` row                                               |
| Permissions   | `band-context.ts` → `requireGroupRole` with explicit refs                                               |
| Events        | `event.bandId` → `event.groupId`; `source` gains `'group'`; `event_group` for co-billing                |
| Reservations  | `bookerId` for `bookerType = 'band'` repoints to `group.id`                                             |
| Storage       | Second R2 bucket for private documents                                                                  |
| Email         | `sendTemplateBatch()` added to the Postmark client                                                      |
| Notifications | One `announcement` type; per-group mute on the membership row                                           |
| Nav           | Band panel splits into Public face / Manage; topbar gains a merged groups dropdown                      |

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

| Finding                                                                                                       | Location                           | Effect                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `opts.includeBandEvents ? undefined : eq(event.source, 'cmc')` — the filter vanishes when true                | `event-service.ts:789, :814`       | Group events would leak onto the public calendar regardless of the flag, and band events cannot be enabled independently. Replace the boolean with a `sources: EventSource[]` allow-list. |
| `processEventSeries()` hard-codes `source: 'cmc'` and `status: 'draft'`, copying neither owner nor `location` | `generation-job.ts:465`            | A club's recurring jazz night would never reach the gig guide. Latent today only because band events cannot be recurring at all.                                                          |
| `invite()` catches `err.message.includes('unique')` against D1's `UNIQUE constraint failed`                   | `band-service.ts:317`              | `BandMemberExistsError` never fires; a duplicate invite surfaces as a 500. `platform-invite-service.ts:153` gets the case right.                                                          |
| `invitedById` declared `.notNull()` **and** `onDelete: 'set null'`                                            | `platform-invite.ts:25`            | Deleting a user who ever sent an invite fails on a NOT NULL violation. Fixed by the new table.                                                                                            |
| `createBandEventForm` declares `slug` in Zod, then ignores it for `params.slug`                               | `band-events.remote.ts:96`         | Two sources of truth for one value. Resolved by the explicit-ref refactor.                                                                                                                |
| Three raw-SQL `band_member` subqueries                                                                        | `band-service.ts` ~200, ~521, ~559 | Invisible to `pnpm check`; throw at runtime after the table is dropped. Needs a CI grep gate.                                                                                             |

**A decision this spec must make, not defer:** whether `processEventSeries()` copies `status` from the prototype. Doing so is required for a club series to publish automatically, but it changes behavior for existing staff CMC series, which today always generate drafts for review. Publish automatically only when `source !== 'cmc'`, preserving the staff review step where it already exists.

---

## Deferred

- **Threaded discussion** — replies to announcements, read receipts, unread counts. `sse.ts` is a per-isolate in-memory registry, adequate for a bell badge but not a real-time transport; group chat would want a Durable Object.
- **Group email aliases** — an inbound address per group fanning out to members. The inbound plumbing exists (Postmark `MailboxHash`, signed reply addresses) but a real mailing list is deliverability work, and the inbox schema is contact-keyed rather than member-keyed.
- **Document folders, versioning, and previews** — flat list, one version, download only.
- **Presigned multipart upload** — needed above the 25 MB in-Worker ceiling.
- **Group room reservations** — clubs and classes booking the space under their own name and credit balance. `bookerType` would gain a value and the booking guard would generalize.
- **Group subdomains** — only band microsites claim one.
- **Public group directory filtering** beyond kind — no genre or tag search for non-band groups.
- **Per-group document quota tiers** — service constants for now.
- **Self-serve joining** — `joinInstructions` is prose; there is no request-to-join flow, and every membership starts with an invitation.

## Open questions

- **Do classes need a roster distinct from enrollment?** A class with a teacher and students maps onto `owner` / `member` cleanly, but term boundaries, attendance, and completion have no representation here. If classes turn out to need any of that, they may deserve their own module built on the group primitive rather than more columns on `group`.
- **Should `band_profile` be reachable by staff at a stable URL?** It has no slug by design. A UUID path under the staff panel works, but it makes sharing a link to an act's record awkward when booking.
- **What happens to a group's documents when it is deleted?** Currently they cascade and their objects are deleted. A committee's minutes may warrant retention past the committee, which would mean an archive path rather than a cascade.

## What this does not cover

- The CMC production workflow — venues, run of show, settlement. That is [production-workflow-spec.md](production-workflow-spec.md); this spec only redefines the band/group boundary it depends on.
- Event creation, ticketing, and the public gig guide, beyond the ownership column and the source allow-list.
- The staff inbox, marketing campaigns, and platform-wide notification preferences.
- Migration mechanics for D1 table rebuilds — see [conventions](../development/conventions.md#table-rebuilds-on-d1).
