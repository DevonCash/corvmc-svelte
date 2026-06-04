# Bands Module — Implementation Plan

Sequenced for a solo developer working through it PR by PR. The public directory page (members + bands) is included as the final epic since the user wants to build it alongside this module.

---

## Epic 1: Schema and service

Foundation layer. Everything else depends on the tables and service existing.

### 1.1 Create band schema

Create `src/lib/server/db/schema/band.ts` with two tables:

**`band`** — `id` (uuid, PK, defaultRandom), `name` (text, not null), `slug` (text, not null), `bio` (text, nullable), `ownerId` (text, not null, FK → user on delete set null), `avatarKey` (text, nullable), `createdAt` (timestamp w/ tz, not null, defaultNow), `updatedAt` (timestamp w/ tz, not null, defaultNow). Unique constraints on `name` and `slug`.

**`band_member`** — `id` (uuid, PK, defaultRandom), `bandId` (text, not null, FK → band on delete cascade), `userId` (text, not null, FK → user on delete cascade), `role` (text, not null), `position` (text, nullable), `status` (text, not null), `invitedById` (text, nullable, FK → user on delete set null), `createdAt` (timestamp w/ tz, not null, defaultNow). Unique constraint on `(bandId, userId)`. Indexes on `userId` and `status`.

Follow the pattern in `event.ts` for column types and constraint style.

### 1.2 Create slug utility

Create `src/lib/server/utils/slug.ts` with a `generateSlug(name: string): string` function (lowercase, replace non-alphanumeric with hyphens, collapse, trim) and an `ensureUniqueSlug(slug: string, table, column): Promise<string>` that appends `-2`, `-3`, etc. if the slug already exists. This is a general utility — not band-specific.

### 1.3 Create band service

Create `src/lib/server/band/band-service.ts` with all functions from the spec:

- `create(ownerId, data)` — DB transaction: insert band (generate slug), insert owner band_member row with `role = 'owner'`, `status = 'active'`. Return the band.
- `update(bandId, data)` — Update name/bio. If name changed, regenerate slug.
- `delete(bandId)` — Delete avatar from R2 (if `avatarKey` set), cancel future reservations where `bookerType = 'band'` and `bookerId = bandId` (using existing `cancel` from reservation-service with `staffOverride: true`), delete the band row (members cascade).
- `getBySlug(slug)` — Select band + active member count.
- `listForUser(userId)` — Join band_member → band where `userId` matches, any status. Return band info + the user's membership status and role.
- `getMembers(bandId)` — Join band_member → user, ordered by role priority (owner first, then admin, then member) then name.
- `searchMembers(query)` — Search users by name (ilike) or email (ilike). Limit 10. Exclude users who already have a band_member row for the given band. Accept `bandId` as a parameter for the exclusion filter.
- `invite(bandId, userId, role, position, invitedById)` — Insert band_member with `status = 'pending'`. Throw if user already has a row for this band.
- `acceptInvitation(memberId, userId)` — Update `status` to `'active'`. Verify the row's `userId` matches and `status = 'pending'`.
- `declineInvitation(memberId, userId)` — Delete the row. Verify userId matches and status is pending.
- `revokeInvitation(memberId)` — Delete the row. Verify status is pending.
- `removeMember(memberId)` — Delete the row. Throw if role is `'owner'`.
- `updateMember(memberId, data)` — Update role/position. Throw if trying to change owner's role.
- `transferOwnership(bandId, newOwnerId, actorId)` — DB transaction: set old owner's role to `'admin'`, set new owner's role to `'owner'`, update `band.ownerId`.
- `leaveBand(bandId, userId)` — Delete the user's band_member row. Throw if role is `'owner'`.
- `getUserRole(bandId, userId)` — Return the user's role in the band, or null if not a member. Used for authorization checks.

### 1.4 Slug utility tests

Create `src/lib/server/utils/slug.spec.ts` (vitest, mocked DB following the project's existing test patterns):

- Basic slugification: `"My Cool Band"` → `"my-cool-band"`.
- Special characters stripped: `"Rock & Roll!!!"` → `"rock-roll"`.
- Consecutive hyphens collapsed: `"a---b"` → `"a-b"`.
- Leading/trailing hyphens trimmed.
- `ensureUniqueSlug` appends `-2` when slug exists.

### 1.5 Band service tests

Create `src/lib/server/band/band-service.spec.ts` (vitest, mocked DB):

- `create` — inserts band row + owner band_member row, generates slug.
- `create` with duplicate name — calls `ensureUniqueSlug`, appends suffix.
- `invite` — inserts band_member with `status = 'pending'`.
- `invite` existing member — throws.
- `acceptInvitation` — updates status to `'active'`, verifies userId matches.
- `acceptInvitation` wrong user — throws.
- `declineInvitation` — deletes the pending row.
- `revokeInvitation` — deletes the pending row.
- `removeMember` — deletes active row.
- `removeMember` on owner — throws.
- `updateMember` — updates role/position, rejects owner demotion.
- `transferOwnership` — swaps roles, updates `band.ownerId`.
- `leaveBand` as owner — throws.
- `leaveBand` as member — deletes row.
- `delete` — cancels future band reservations, deletes avatar from R2, deletes band.
- `searchMembers` — returns matching users, excludes existing band members.
- `getUserRole` — returns role for member, null for non-member.

---

## Epic 2: Member panel — My Bands and Create Band

Depends on: Epic 1.

### 2.1 My Bands page

Create `src/routes/member/bands/+page.server.ts` — load function calls `listForUser(userId)`. Returns bands split into active memberships and pending invitations.

Create `src/routes/member/bands/+page.svelte` — two sections:

- **Pending invitations** (if any) — cards showing band name, invited by, role offered, position. Accept and Decline buttons.
- **My bands** — cards showing band name, user's role, member count. Each links to `/band/{slug}/`.

Create `src/routes/member/bands/data.remote.ts` — form handlers for `acceptInvitation` and `declineInvitation`.

### 2.2 Create Band page

Create `src/routes/member/bands/new/+page.svelte` — form with name (required) and bio (optional textarea).

Create `src/routes/member/bands/new/data.remote.ts` — `createBand` form handler. Calls `band-service.create()`, returns the slug for redirect.

On success, redirect to `/band/{slug}/`.

### 2.3 Add Bands to member nav

Update `src/routes/member/+layout.svelte` — add a "Bands" nav item with `IconUsersGroup` (or similar tabler icon) linking to `/member/bands`.

### 2.4 My Bands and Create Band tests

Create `src/routes/member/bands/bands.spec.ts`:

- `createBand` form handler — calls `band-service.create`, returns slug.
- `acceptInvitation` form handler — calls `band-service.acceptInvitation` with correct userId.
- `declineInvitation` form handler — calls `band-service.declineInvitation`, deletes row.
- Load function returns bands split by status (active vs pending).

---

## Epic 3: Band panel — layout and dashboard

Depends on: Epic 1, Epic 2.

### 3.1 Band panel layout

Create `src/routes/band/[slug]/+layout.server.ts` — load function that:

1. Calls `getBySlug(slug)` to resolve the band.
2. Checks if the current user is an active member (or has staff/admin role via `hasAnyRole`).
3. Throws 404 if band not found, 403 if not a member.
4. Returns band data and the user's role in the band.

Create `src/routes/band/[slug]/+layout.svelte` — band panel layout with nav items: Dashboard, Members, Reservations, Edit (if owner/admin), Settings (if owner). Display band name in the header. Include a "Leave Band" button (hidden for owners) in the nav footer or settings.

### 3.2 Band dashboard

Create `src/routes/band/[slug]/+page.server.ts` — load upcoming reservations for this band (where `bookerType = 'band'` and `bookerId = band.id`, `startsAt > now()`, not cancelled). Also load active member count.

Create `src/routes/band/[slug]/+page.svelte` — band name, member count, list of upcoming reservations (reuse reservation display patterns from member dashboard). Quick links to Members and Book Practice Space.

### 3.3 Band layout and dashboard tests

Create `src/routes/band/band-panel.spec.ts`:

- Layout load — resolves band by slug, returns band data and user role.
- Layout load — throws 404 for unknown slug.
- Layout load — throws 403 for non-member (not staff).
- Layout load — allows staff/admin access to any band.
- Dashboard load — returns upcoming reservations for the band.

---

## Epic 4: Band panel — members and invitations

Depends on: Epic 3.

### 4.1 Members page

Create `src/routes/band/[slug]/members/+page.server.ts` — load `getMembers(bandId)`. Split into active members and pending invitations.

Create `src/routes/band/[slug]/members/+page.svelte` — two sections:

- **Active members** — table/list showing name, role, position. Actions (gated by the current user's role): remove member, change role, transfer ownership (owner only).
- **Pending invitations** — list showing invitee name, role, position. Action: revoke.
- **Invite form** — search input that queries `searchMembers`, role select (member/admin), optional position text input. Visible to owner and admin only.

### 4.2 Members data handlers

Create `src/routes/band/[slug]/members/data.remote.ts` — form/query handlers:

- `searchMembers` query — calls band-service searchMembers with the band ID for exclusion.
- `inviteMember` form — calls `invite()`.
- `removeMember` form — calls `removeMember()`.
- `revokeInvitation` form — calls `revokeInvitation()`.
- `updateMember` form — calls `updateMember()`.
- `transferOwnership` form — calls `transferOwnership()`. Show confirmation modal before submitting.
- `leaveBand` form — calls `leaveBand()`. Redirect to `/member/bands` on success.

### 4.3 Members and invitations tests

Create `src/routes/band/[slug]/members/members.spec.ts`:

- `inviteMember` — calls `invite()` with correct params, rejects if user already a member.
- `removeMember` — calls `removeMember()`, rejects removal of owner.
- `revokeInvitation` — deletes pending row.
- `updateMember` — updates role/position.
- `transferOwnership` — swaps owner role, updates `band.ownerId`.
- `leaveBand` — deletes member row, rejects if owner.
- `searchMembers` query — returns matches, excludes existing band members.

---

## Epic 5: Band panel — reservations and booking

Depends on: Epic 3.

### 5.1 Band reservations page

Create `src/routes/band/[slug]/reservations/+page.server.ts` — load reservations where `bookerType = 'band'` and `bookerId = band.id`. Include the booking user's name via join on `createdByUserId`.

Create `src/routes/band/[slug]/reservations/+page.svelte` — reservation list following the same pattern as member reservations (day-grouped, with StatusBadge, cancel action). Show who booked each reservation.

### 5.2 Band booking flow

Create `src/routes/band/[slug]/reservations/new/+page.svelte` and `data.remote.ts` — reuse the member reservation booking pattern. The key difference: `bookerType = 'band'`, `bookerId = band.id`. The `createdByUserId` is still the logged-in user.

The form fields are the same: date, start time, end time, notes. Conflict checking works the same way.

### 5.3 Cancel band reservation

Add a cancel handler in `src/routes/band/[slug]/reservations/data.remote.ts`. Any band member can cancel a band reservation (or scope to owner/admin if preferred — the spec says all members can book, so all can cancel too).

### 5.4 Band reservation tests

Create `src/routes/band/[slug]/reservations/reservations.spec.ts`:

- `bookReservation` form — creates reservation with `bookerType = 'band'`, `bookerId = band.id`.
- `cancelReservation` form — cancels the reservation.
- Load function — returns only reservations for this band, excludes other bands' reservations.

---

## Epic 6: Band panel — profile editing and settings

Depends on: Epic 3.

### 6.1 Edit profile page

Create `src/routes/band/[slug]/edit/+page.svelte` and `data.remote.ts` — form with name, bio, avatar upload. Only accessible to owner and admin (enforced in layout data by checking role).

Avatar upload: file input that POSTs to `/api/bands/[id]/avatar`. Display current avatar or a placeholder.

### 6.2 Avatar API

Create `src/routes/api/bands/[id]/avatar/+server.ts` — POST handler (upload) and DELETE handler (remove). Follow the event poster pattern: accept multipart form data, store at `bands/avatars/{id}.{ext}` in R2, update `band.avatarKey`. Verify the requester is an owner/admin of the band.

### 6.3 Settings page

Create `src/routes/band/[slug]/settings/+page.svelte` and `data.remote.ts` — owner-only page with:

- Delete Band button with confirmation modal. Calls `band-service.delete()`. Redirects to `/member/bands`.
- Transfer Ownership could also live here as an alternative to the members page (or just link to it).

### 6.4 Profile and settings tests

Create `src/routes/band/[slug]/edit/edit.spec.ts`:

- `updateBand` form — updates name/bio, regenerates slug if name changed.
- Avatar POST handler — stores file in R2, updates `avatarKey`.
- Avatar DELETE handler — removes from R2, clears `avatarKey`.
- Rejects updates from non-owner/admin.

Create `src/routes/band/[slug]/settings/settings.spec.ts`:

- `deleteBand` form — cancels future reservations, deletes avatar, deletes band.
- Rejects deletion from non-owner.

---

## Epic 7: Dashboard integration

Depends on: Epic 1.

### 7.1 Show band reservations on member dashboard

Update `src/routes/member/+page.server.ts` — in addition to querying reservations by `createdByUserId`, also query reservations where `bookerType = 'band'` and `bookerId` is in the set of band IDs the user is an active member of. Merge and sort by `startsAt`.

Update `src/routes/member/+page.svelte` — band reservations display the band name alongside the reservation info.

### 7.2 Show pending invitations on member dashboard

Update `src/routes/member/+page.server.ts` — load pending invitation count for the user.

Update `src/routes/member/+page.svelte` — add a notification banner or badge in the quick links area: "You have N pending band invitations" linking to `/member/bands`.

### 7.3 Dashboard integration tests

Update `src/routes/member/dashboard.spec.ts` (or create if needed):

- Dashboard load includes band reservations for bands the user is an active member of.
- Band reservations are excluded for bands the user is only a pending invitee of.
- Pending invitation count is returned.

---

## Epic 8: Public directory

Depends on: Epic 1 (for bands), but the members tab has no dependencies on the bands module.

### 8.1 Directory page

Create `src/routes/directory/+page.server.ts` — load both:

- Members: all users with `deletedAt IS NULL`, select name, pronouns, avatar fields. (Check what user fields are appropriate for a public directory — may need to respect a "listed in directory" flag if one exists, otherwise list all non-deleted users.)
- Bands: all bands, select name, slug, bio (truncated), avatarKey, active member count.

Create `src/routes/directory/+page.svelte` — tabbed page using the existing TabBar component. Two tabs:

- **Members** — grid of member cards showing name, pronouns, avatar (using the MemberLink component pattern or a simpler card).
- **Bands** — grid of band cards showing name, bio excerpt, avatar, member count. Each links to `/directory/bands/{slug}`.

### 8.2 Public band profile

Create `src/routes/directory/bands/[slug]/+page.server.ts` — load band by slug with active members (names and positions). Load avatar URL if `avatarKey` is set.

Create `src/routes/directory/bands/[slug]/+page.svelte` — public profile: band name, avatar, bio, member list (name + position).

### 8.3 Navigation

Add "Directory" to the site's public navigation (wherever public nav items live — check the root layout).

### 8.4 Directory tests

Create `src/routes/directory/directory.spec.ts`:

- Load returns non-deleted members and all bands with active member counts.
- Public band profile load returns band with active members (names, positions).
- Public band profile throws 404 for unknown slug.

### 8.5 Compile check

Run `pnpm check` to verify no TypeScript errors across all new files.

---

## Dependency graph

```
Epic 1 (schema + service + tests)
  ├─▶ Epic 2 (member panel: my bands + create + tests)
  │     └─▶ Epic 3 (band panel: layout + dashboard + tests)
  │           ├─▶ Epic 4 (band panel: members + invitations + tests)
  │           ├─▶ Epic 5 (band panel: reservations + booking + tests)
  │           └─▶ Epic 6 (band panel: edit + settings + tests)
  ├─▶ Epic 7 (dashboard integration + tests)
  └─▶ Epic 8 (public directory + tests)
```

Epics 4, 5, and 6 are independent of each other and can be built in any order after Epic 3. Epic 7 and 8 can be built in parallel with Epics 3–6.

---

## Smoke tests

1. **Full band lifecycle**: Create band → invite member → member accepts → band books a practice space → reservation shows on band page and both members' dashboards → member leaves band → owner deletes band → future reservations are cancelled.

2. **Directory**: Visit `/directory` → see members tab with member cards → switch to bands tab → see band cards → click a band → see public profile with member list.

---

## Out of scope for this plan

- Band visibility (public/members-only/private)
- Genre and influence tags
- Links and social embeds on band profile
- Band-event association
- Staff bands resource (dedicated admin page)
- Avatar image conversions (thumbnail, medium, large)
- Email notifications for invitations
- Band productions
