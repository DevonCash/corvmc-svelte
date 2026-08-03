# `admin` vs `staff` — Spec

## Purpose

The app has two elevated roles and no difference between them.

`requireStaff()` (`src/lib/server/authorization.ts:70`) is
`hasAnyRole(userId, ['admin', 'staff'])`. So is `isStaff()`, so is
`requireStaffRole()`, so is `listStaffUsers()`, and so are all three checks in
`layout.remote.ts` and both in `account.remote.ts`. A grep for `'admin'` across
`src/lib/server` and `src/lib/remote` finds it only ever paired with `'staff'`
in the same array — never on its own.

The one place the two are distinguished is cosmetic: `primaryRoleFor()` orders
`admin` above `staff` so the users list can show a different icon.

**Holding `admin` conveys no authority that `staff` does not already have.** A
staff member can grant themselves `admin`; the only thing stopping the reverse
is the last-admin guard added in #162, which protects a role that does nothing.

This is not currently exploitable — it is a _misleading_ model, not a hole. But
it means the panel's most dangerous capabilities (purging accounts, moving
credit balances, granting elevated roles) are all available to anyone who is
handed panel access for a mundane reason, and there is no way to express "let
this volunteer take payments but not delete members."

## The two options

### Option A — collapse to one role

Delete `admin` as an authorization concept. `requireStaff()` checks `staff`
only. Existing `admin` holders get `staff`.

**For:** the model matches reality; nothing pretends to be a boundary that
isn't; the last-admin guard, the role-priority ordering and the two-icon
treatment in the users list all disappear. Least code.

**Against:** the collective is small now, but "everyone with panel access can
permanently delete a member and move money" is a policy, not an accident, and it
should be a chosen one. Collapsing also throws away the migrated Laravel role
assignments, which encode somebody's earlier judgement about who was trusted
with what.

### Option B — make the split real (recommended)

Keep both roles and give `admin` a specific, small set of exclusive powers.

**For:** matches how the organisation actually works (a couple of long-term
organisers vs. a rotating set of volunteers on the desk); makes the escalation
guard meaningful; lets panel access be handed out freely without handing out
account deletion.

**Against:** every new guard is a place to get it wrong, and a wrong guard is a
403 for someone mid-shift. Needs a real answer for "the only admin is
unreachable and something needs doing."

**Recommendation: Option B**, with the admin-only set kept deliberately tiny.

## Proposed split

`admin`-only — irreversible, financial, or authority-granting:

| Action                    | Where                                                        |
| ------------------------- | ------------------------------------------------------------ |
| Grant or remove `admin`   | `updateUser`                                                 |
| Grant or remove `staff`   | `updateUser`                                                 |
| Purge a user              | `purgeUser`                                                  |
| Adjust credits            | `adjustCredits`                                              |
| Change site settings      | `settings.remote.ts` (products, integrations, feature flags) |
| Change a user's email     | `staff-email-change-spec.md`, once it exists                 |
| View the global audit log | `audit-log-spec.md`, `/staff/audit`                          |

Everything else stays `staff`: the users list and detail page, reservations,
payments/refunds against a booking, events and ticketing, bands, equipment,
closures, the inbox, help authoring, marketing.

Two judgement calls worth naming:

- **Deactivation stays `staff`.** It is the routine front-desk action, and it is
  reversible (more so once `reactivation-restore-spec.md` lands). Purge, which
  is not reversible, is admin-only.
- **Refunds stay `staff`, credit adjustment goes admin.** A refund is bounded by
  a real payment that happened; a credit adjustment mints value out of nothing.

## Implementation

Add one function beside `requireStaff`, same shape:

```ts
export async function requireAdmin() {
	const { locals } = getRequestEvent();
	if (!locals.user) throw error(401, 'Not authenticated');
	if (!(await hasRole(locals.user.id, 'admin'))) throw error(403, 'Admin access required');
	return locals.user;
}
```

Then, per the rule #162 established — **a remote function is only as guarded as
its own first line** — swap `requireStaff()` for `requireAdmin()` as the first
statement of each handler in the table above. Route and layout guards do not
protect remote functions; there is nothing else to change.

`updateUser` needs finer treatment than a whole-handler swap: it is one form
that edits profile fields _and_ roles. Proposal — keep `requireStaff()` at the
top, and reject the request with a 403 only when the submitted role set differs
from the current one and the caller is not admin. That keeps a volunteer able to
fix a phone number on an admin's account, which they should be able to do.

UI follows the guards rather than leading them: the Roles `FormField` renders
`readonly` for non-admins, Danger Zone's purge button and `AdjustCreditsAction`
are hidden, and `/staff/settings` and `/staff/audit` drop out of the nav. Hiding
a control is not a guard — it just stops staff walking into a 403.

`layout.remote.ts` needs to return `isAdmin` alongside its existing staff flag so
the nav can filter.

## Migration and rollout

- No schema change. Both roles already exist in `roles`; `model_has_roles`
  already carries the assignments.
- **Before merging, confirm at least two people hold `admin` in production.**
  The last-admin guard prevents dropping to zero from the UI, but it cannot
  create the second one, and the split makes a single-admin org one lost password
  away from being unable to change a setting.
- The `permissions` / `model_has_permissions` / `role_has_permissions` tables
  stay untouched. They are populated by the Postgres migrator and read by
  nothing (see `src/lib/server/db/schema/authorization.ts`). This spec
  deliberately does **not** build on them — a real permission system is a much
  larger change than two roles, and half-adopting spatie's model would leave two
  competing authorization mechanisms.

## Open questions

1. **What is the break-glass path?** If the only admin is unavailable and a
   setting has to change, what happens? Options: a documented DB-level role
   grant (honest, requires D1 access), or a second "owner" account whose
   credentials live in the collective's password manager. Needs an answer before
   this ships, not after.
2. **Is `adjustCredits` really admin-only?** It is the most contested row in the
   table. Comping an hour for a member whose session was interrupted is a
   front-desk kindness, and routing it through an admin makes it not happen.
   Possible middle ground: staff may add up to N hours, admin for anything
   larger or for any deduction. That is a bounded-authority model, which is more
   design than a role check.
3. **Do the four other seeded roles matter?** `scripts/seed-dev.ts` seeds
   `admin`, `staff`, `member`, `volunteer`, `sustaining`. `volunteer` is checked
   nowhere at all, and `sustaining` is computed from Stripe
   (`isSustainingMemberSql`) rather than read from the role. Either they mean
   something and should be enforced, or they are the same dead weight as the
   permission tables.
4. **How does this interact with help-article `minRole`?** `help-service.ts`
   filters categories and articles by `inArray(minRole, roles)` — an exact
   membership test against the user's role names, not a hierarchy. An article
   with `minRole: 'staff'` is therefore invisible to a user who holds only
   `admin`. That is already latently wrong today and the split makes it
   reachable; it needs fixing in the same change.
5. **Does the band-level `admin` role collide?** `bandMember.role` uses
   `'owner' | 'admin' | 'member'` in a completely separate namespace
   (`profile-service.ts:188`). No functional conflict, but `requireAdmin` and
   `requireBandAdmin` sitting next to each other meaning different things is a
   readability trap worth a naming pass.
