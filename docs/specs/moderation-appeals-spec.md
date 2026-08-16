# Moderation Appeals — contesting a posting-trust decision

## Purpose

When staff uphold a content report, the member on the receiving end loses two
things at once. The post comes down, and their future posts in that domain queue
for staff review before they publish. Both are wired in one place — `resolveFlag`
in `src/lib/server/flag/flag-service.ts` — and the second one cannot be
contested. The member's only recourse is to open a thread in `/member/messages`
and hope somebody reads it.

That is workable at the collective's current size and clearly not workable at
three times it. The structural problem is not volume, it is who is being asked to
improvise: the person who most needs a channel is the one who has just been told
they are not trusted, which is exactly the moment an informal "just ask us" stops
working. Nobody writes that message. They just stop posting.

It also leaves a loose end on the staff side. **Restore posting trust** on
`/staff/users/[id]` is a button somebody has to remember to press after a
conversation that happened somewhere else entirely — a different inbox, a
different week, possibly a hallway. The decision to forgive and the act of
forgiving are separated by human memory, which is the weakest component in the
system.

This is the **Moderation Appeals** entry in `IDEAS.md`, the deliberate follow-up
to the suggestion board (`d4df38c`).

## What an appeal is for

**An appeal contests a judgment about the member, not a judgment about a post.**

That sentence is the whole scope of this feature, and everything below follows
from it. Losing posting trust is a call about the person: staff have decided this
member's future work needs checking before it goes out. It is the consequence
with duration, it attaches to them rather than to a thing they wrote, and there
is no self-service route out of it. That is what an appeal is for.

A takedown is a call about a post — whether this particular thing should be
public. Appeals are the wrong instrument for it, and reaching for them would make
the appeal queue a negotiation surface for content, where every declined listing
becomes a case to argue rather than a draft to fix. The right instrument for a
takedown is a **return state**: staff hand the thing back with a reason, the
member edits it, it goes round again. Community listings already have exactly
that, and suggestions are missing it — see [Content recourse](#content-recourse-belongs-to-the-domain-not-the-appeal).

Keeping the two separate is what makes each one answerable. "Was this call about
me fair?" is a question a second staffer can genuinely review. "Is this listing
good enough?" is a question that wants an edit, not an adjudication.

## How it works

Sam posts a gig listing on the community calendar. Someone reports it, a staffer
reads the report and agrees with it, and two things happen — the listing comes
off the public guide, and Sam's next listing will wait for a staffer before it
goes up. Sam gets an email saying so, with the staffer's note in it.

The listing itself Sam can deal with: it is back in their drafts, editable, and
republishing it is one button. What Sam cannot do anything about is the second
part — being on review from now on.

So on the banner that tells Sam they are on review, there is a button: **Appeal
this decision**. Sam writes a paragraph saying why they think the call was wrong,
and sends it. Nothing changes yet. Sam stays on review while this is looked at,
can see the appeal is pending, and cannot file a second one about the same
decision.

The appeal shows up on the staff report page, directly under the decision it is
contesting, so whoever picks it up reads the original report, the staffer's note,
and Sam's objection in one place, in that order, without going and finding
anything. The staff **Content Flags** nav item grows a count of appeals waiting —
it has never had one — so an appeal is not sitting on somebody happening to look.

Whoever answers it cannot be the staffer who made the original call. That button
is switched off for them, with the reason written next to it. They _can_ undo
their own decision if they have changed their mind — they just cannot be the one
who confirms it was right.

The answer is one question: does Sam come off review? Whichever way it goes, it
happens right there — saying Sam comes off review _is_ taking Sam off review.
Nobody has to remember a second button on a different page a week later.

Sam gets an email with the answer and the staffer's reasoning. If it was a no,
that is the end of it as far as Sam is concerned. Staff can reopen the appeal
later if something new turns up, but Sam cannot keep filing.

```
        member files
  (none) ──────────────▶ pending ──staff decide──▶ granted | denied
                            ▲                          │
                            └─────staff reopen─────────┘
```

## Scope

**In:**

- A member-filed appeal against the **posting-trust consequence** of an upheld
  (`resolved`) `content_flag` on their own community listing or suggestion.
- One appeal per decision, enforced in the schema; reopenable by staff.
- One outcome — granted or denied — applied immediately, with the standing
  restore wired to the outcome rather than left to a staffer's memory.
- A hard identity block: the staffer who resolved the flag cannot deny the
  appeal, though they may grant it.
- A `standing.ts` facade over the two existing standing tables, shaped like the
  scoped `member_standing` they will eventually become.
- Member entry points on the standing banners, and a staff surface on the
  existing flag detail page. No new routes.

**Out (deliberately):**

- **Contesting the takedown itself.** Not an oversight and not a phase two — a
  different mechanism entirely. See Content recourse below.
- **Appealing a dismissed report.** Nothing was lost. The reporter has no
  standing to contest; their report was read and answered, which is all a report
  entitles anyone to.
- **Appealing a flag on a member or band profile.** Upholding one has no
  consequence today — `resolveFlag` only acts on the `event` and `suggestion`
  branches — so there is no posting trust to have lost.
- **A second-level appeal.** A denied appeal has been read by two people. A third
  is a committee, and the collective does not have one.
- **Any change to the report-filing side.** The griefing tradeoff recorded in
  `docs/specs/member-suggestions-spec.md` (one report hides a suggestion) is
  untouched here. This feature is downstream of it.
- **Merging `community_event_standing` and `suggestion_standing`.** Recommended,
  but as its own change — see Decisions.

## Decisions

### Content recourse belongs to the domain, not the appeal

The two domains that have standing handle takedowns very differently, and the
difference decides where the remaining work goes.

**Community listings already have a return state, and it works.**
`updateCommunityEvent` blocks editing only on `cancelled`, so both takedown paths
land somewhere the member can act:

- Staff reject a submission → `rejected` → the member edits → `publishCommunityEvent`
  normalizes `rejected`→`draft`→publish. The code says why: "The member has edited
  it since; this is a fresh attempt, not a re-run of the one staff turned down."
- Staff unpublish a live listing → `draft` → same path.

Rejection notes are required and stored on `event.reviewNotes` precisely so the
member can see what to fix. This is a conversation with a turn in it, and it does
not need an appeal.

**Suggestions do not.** `hidden` is terminal:
`src/lib/server/suggestion/suggestion-service.ts` makes a post editable only when
`visibility` is `visible` or `pending_review`, deliberately — "editing a hidden
post would be a way to launder it back past the reason it went down." A member
can post a fresh suggestion, but that is a different row; the votes and the
history of the original are gone. Two paths land there, and neither creates a
flag:

- staff hide a visible suggestion directly (`setSuggestionVisibility`)
- staff reject a `pending_review` suggestion (`reviewSuggestion`) — which only
  happens to members already on review

So `hidden` is doing double duty as both "this is bad, gone" and "not like this,"
which is the exact conflation `docs/specs/community-events-spec.md` refused when
it declined to reuse `cancelled` for `rejected`. **The fix is a returnable
suggestion state, not an appeal route** — staff hand it back with a note, the
author edits, it re-enters `pending_review`. That also answers the laundering
worry, because the return is an explicit staff act rather than the author quietly
rewriting a hidden post.

That is a separate feature in the suggestion domain and is not specced here. It
is named because the alternative — routing hidden suggestions through appeals —
is the tempting shortcut, and it would drag content adjudication into a queue
built for behavior calls.

### The appeal hangs off the flag, not off a message thread

`IDEAS.md` proposed attaching an appeal to the upheld flag rather than opening a
new inbox thread. Tested against the alternative, it holds.

Reusing `src/lib/server/inbox/` is genuinely tempting. Threading, staff
assignment, unread counts, notification plumbing and a member-facing UI all
already exist and are shipped; the appeal would be `startPortalConversation` with
a link pasted in, and the schema delta would be zero.

It fails on the thing this feature exists to fix. **A thread has no outcome
state.** There is nothing on a conversation that can mean "granted", nothing that
can be queried to find appeals nobody has answered, and — decisively — nothing
that can _cause_ the standing restore. The remedy would still be a button on
`/staff/users/[id]` that a staffer has to navigate to and remember to press after
the conversation ends, which is precisely the failure `IDEAS.md` names as the
reason to build this at all. Reusing the inbox would produce a nicer-looking
version of the status quo.

Two smaller strikes. The inbox is behind the `staffInbox` feature flag, so
appeals would inherit a kill switch that has nothing to do with them. And
splitting the record from the decision means a staffer reads the objection in one
place and the report it objects to in another — the ordering that makes a flag
attachment worth having is that the report, the staff note, and the member's
answer to it are one page, read top to bottom.

The hybrid (an appeal row for state, a linked thread for discussion) was
considered and dropped: two sources of truth for one conversation, and it drags
the flag dependency back in anyway.

What is lost by not using the inbox is **back-and-forth**. An appeal is one
statement from the member and one answer from staff, with no way to ask a
clarifying question inside the appeal. That is an accepted cost — staff can still
message the member through the existing channel, and an appeal that needs three
rounds of discussion is a conversation, not a form. If it turns out to need
threading, the appeal row is the right place to hang a thread id later.

### The staffer who made the call cannot ratify it — but may overturn it

`admin` and `staff` are the same authorization everywhere in this app
(`docs/specs/admin-vs-staff-spec.md`), and nothing here changes that. So "a
second staffer" cannot be expressed as a role check; it has to be an **identity**
check against `contentFlag.resolvedByUserId`. Any staffer who is not that person
may decide the appeal.

A hard block with no override raises the obvious objection: with a small
volunteer staff, the only person around may be the one who made the call, and the
appeal sits. The answer is an asymmetry rather than an escape hatch.

**You may overturn yourself. You may not ratify yourself.**

The original resolver may grant an appeal and may not deny one. "I've thought
about it and I was wrong" needs no second opinion; it costs the collective
nothing and the member benefits immediately. "I've thought about it and I was
right" is the judgement that needs somebody else, because it is the one where the
reviewer's interest and the member's diverge.

What this buys is that the deadlock only ever blocks the outcome the member has
no reason to want faster. An appeal that deserves to be granted can always be
granted by whoever is around, today. An appeal that deserves denial waits for a
second staffer — and while it waits, nothing about the member's situation is
worse than it was before they filed, because nothing pauses (below). A denial
arriving late is a denial arriving late.

Rejected: a soft warning that any staffer may click through. It puts the whole
rule on norms, and norms are what this feature exists to replace. Also rejected:
an ageing escalation that notifies everyone after N days. At this size the
escalation notifies the same person who is already blocked.

One edge, recorded because the FK makes it: `contentFlag.resolvedByUserId` is
`onDelete: 'set null'`. If the resolving staffer's account is deleted, the field
is null, the identity comparison never matches, and any staffer may decide the
appeal. That is the right behaviour — the rule protects against self-review, and
there is no self left to review.

### Nothing pauses while an appeal is pending

The member stays on review. Filing an appeal changes their situation not at all
until it is decided.

The alternative — restoring trust for the duration — is kinder and is an exploit.
It hands anyone who has been put on review a way to take themselves off it, for
as long as the queue is slow, by objecting. The worse staff are at keeping up,
the better it works, which is exactly backwards: the mechanism is strongest when
the collective is least able to check it.

The cost of not pausing is bounded, and worth stating so the tradeoff is legible.
A member on review is not silenced — they can still post; their posts queue.
Waiting on an appeal costs them the delay between writing and publishing, not the
ability to participate. That is what makes "nothing pauses" tolerable, and it is
the same property that makes the reviewer deadlock above survivable.

### One appeal per decision, reopenable by staff

`uniqueIndex(flagId)` on `moderation_appeal`. A member gets one appeal per upheld
report, and re-filing is a database error rather than a policy the service has to
remember.

A denial is final from the member's side. That is the whole benefit of the
constraint — an appeal queue where a determined member can re-argue a decision
already reviewed twice is a way to spend unlimited staff attention, and the
members most likely to do it are the ones the moderation system is already
straining against.

But "final" should be a policy staff hold, not a wall the code builds. Staff can
**reopen** an appeal, which clears the decision and puts the row back to pending.
New information does turn up; a member who was wrongly moderated and denied on a
misunderstanding should not have their only remaining route be a message thread —
that is the failure this feature exists to fix, and it would be perverse to
reintroduce it at the one point where the stakes are highest.

Reopening reuses the row rather than creating a second one, so the unique index
holds and the appeal's history stays in one place. It is a staff action with no
member-facing trigger: a member cannot ask for a reopen through the appeal, which
keeps the "one appeal" property honest.

### The unique index is the abuse control; the rate limit is a velocity backstop

An appeal queue is a new surface to flood, and the suggestion board already
carries a griefing tradeoff on the report side. Worth being explicit about how
much of a target this actually is.

**The volume is structurally bounded.** An appeal requires an upheld flag against
content you authored, and each such flag admits exactly one appeal. A member
cannot generate appeals; they can only spend the ones moderation has handed them.
The ceiling per member is the number of times staff have upheld a report against
them — a number staff control, and one that is small for exactly the members who
would abuse it, because each one is a decision a staffer made deliberately.

On top of that, `allowRateLimited` (`src/lib/server/rate-limit.ts`) at
5/hour/member on the file path, matching `flagSuggestion`. It is a velocity
backstop against a script, not the cap.

Does `allowRateLimited` cover it? Yes, with its documented caveat stated plainly:
KV is eventually consistent, so it is a soft throttle rather than a guarantee, and
its own docstring says to pair it with a stronger gate on public endpoints. This
endpoint is not public. Filing requires an authenticated member, an upheld flag,
and ownership of the content — three gates that a Turnstile would sit behind
redundantly.

**No cap on open appeals.** An earlier draft had one, copied from
`MAX_OPEN_PORTAL_THREADS`. That cap protects a genuinely scarce resource — every
open portal thread is an unbounded conversation demanding a staffer's ongoing
attention. An appeal is one paragraph and one decision, and its count is already
bounded by the number of times staff have moderated the member. This is the same
reasoning `docs/specs/community-events-spec.md` used to reject a total listing
cap, and it lands the same way: the only person a cap reliably stops is the
member with several legitimate grievances.

### Standing stays in two tables, behind one facade

`docs/specs/member-suggestions-spec.md` recorded the duplication between
`community_event_standing` and `suggestion_standing` as knowing, with a
rule-of-three note: when a third domain needs standing, merge all three into a
scoped `member_standing`.

**Appeals is not that third domain.** It introduces no standing of its own —
nobody is put on probation for how they appeal. It is the first _consumer_ that
has to read and write standing generically, across whichever domain the flag came
from. The rule-of-three trigger has not fired, and folding a rename and backfill
of two live tables into a new feature's diff would put two working domains at
risk in service of one that nobody depends on yet.

What appeals does create is a third copy of the same dispatch. `createFlag`
switches on `entityType`, `resolveFlag` switches on `entityType`, and now the
appeal outcome would too. Three copies of a switch is its own rule of three, and
this is the one worth acting on.

So: a facade, not a migration. `src/lib/server/moderation/standing.ts`:

```ts
getStanding({ userId, scope });
revokeStanding({ userId, scope, flagId, staffId, reason });
restoreStanding({ userId, scope, staffId });
scopeForFlag(flag): StandingScope | null;
```

Two properties make this worth its own file rather than a helper:

**The signature is the merged table's signature.** `(userId, scope)` is exactly
the key `member_standing` will have. Appeals is written against the final API on
day one, so the eventual merge is a body swap plus a backfill with **zero
call-site changes** — a change contained in one file, reviewable as one thing,
instead of a rename rippling through two feature areas and a new one.

**`scopeForFlag` is the one place the mapping lives**, and the mapping is not the
identity function people assume. `flagEntityTypes` is not the scope vocabulary:
`event` costs standing only when `event.source === 'community'`, and
`member_profile` / `band_profile` cost nothing at all. That conditional currently
lives inline in `resolveFlag`; pulling it out is what stops the appeal service
from reimplementing it slightly differently.

`resolveFlag` is refactored onto the facade as part of this, dropping its two
dynamic standing imports. Its behaviour is unchanged and `flag-service.spec.ts`
is the proof.

**The merge itself gets its own PR**, landing before the third moderated domain
does (forum posts, classifieds, gear requests — several are queued in
`IDEAS.md`). Recommendation, so the next person doesn't have to re-derive it:

- **Do merge**, into `member_standing` keyed `(userId, scope)`. The two tables are
  byte-identical, and every domain still to come wants the same five columns.
  This is deduplication, not premature abstraction.
- **Do not collapse the scope axis.** A single global standing — one probation
  covering all content — is rejected outright, for the reason the suggestions
  spec already gave: an upheld report about a gig listing must not silently put
  someone on probation for suggestions. Those are different judgements about
  different behaviour.
- **Do not define scopes with no behaviour behind them.** `standingScopes` is
  `['community_event', 'suggestion']` and stops there. Adding `member_profile` for
  symmetry would invent a probation state nothing reads — a column that lies
  until someone builds profile-edit review.

### Ordering, with no transactions

D1 has no transactions and `custom/no-db-transaction` is an eslint error, so
granting an appeal — which touches standing and the appeal row — needs an
ordering where a crash leaves an obvious, re-runnable state. The house pattern is
the merge algorithm in `suggestion-service.ts`: **do the effect first, mark the
record last.**

```
1. restoreStanding({ userId, scope, staffId })
2. stamp the appeal decided — decidedAt / decidedBy / outcome / notes
```

`restoreStanding` is idempotent: both underlying implementations are an
unconditional `SET requires_review = false`, not a read-modify-write. So a crash
between the two steps leaves an appeal that still reads **pending** with the
member already restored: visible in the queue, and repaired by clicking Grant
again.

The reverse order is the one that must not be written. It would leave an appeal
displaying **granted** over a member still on review — a state that looks
finished, notifies nobody, and is only discovered when the member writes in to
ask why nothing changed. That is the failure mode this whole feature exists to
remove, so reintroducing it as a crash artifact would be a particularly bad joke.

Being standing-only is what keeps this to two steps. An earlier draft also
restored the content, which dragged in two asymmetries that have nothing to do
with adjudicating behaviour: a community listing comes back as a `draft` and
would have to be republished around the standing-aware publish path, and its
poster had been destroyed by the takedown. The second is now fixed on its own
merits — `unpublishWithNotice` rotates the poster to an unguessable key instead
of deleting it — but neither belongs in an appeal.

### `decidedAt IS NULL` is the pending predicate

The appeal has no `status` column. Pending is `decidedAt IS NULL` — one
predicate, hard to get wrong, in the spirit of the suggestion board's
`eq(visibility, 'visible')`.

Reopening is then `decidedAt = NULL` plus clearing the outcome, which puts the
row back in the queue by the same predicate that put it there originally. No
separate `reopened` state, because nothing behaves differently about a reopened
appeal — it is pending, and pending is pending.

## Schema delta

`src/lib/server/db/schema/moderation.ts` (new) — **`moderation_appeal`**:

| column                     | notes                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| `id`                       | uuid pk                                                                                  |
| `flagId` → `content_flag`  | **`uniqueIndex`** — one appeal per decision, enforced by the database                    |
| `appellantUserId` → `user` | `set null`, matching `contentFlag.reportedByUserId` — a deleted account keeps the record |
| `scope`                    | `standingScopes`, stamped at file time from `scopeForFlag`                               |
| `body`                     | the member's argument, `APPEAL_BODY_MAX`                                                 |
| `outcome`                  | `granted` / `denied`; null while pending                                                 |
| `decisionNotes`            | the staffer's reasoning, shown to the member                                             |
| `decidedByUserId` → `user` | `set null`                                                                               |
| `decidedAt`                | **null ⟺ pending**                                                                       |
| `createdAt`                |                                                                                          |

Indexed on `decidedAt` (the queue), `appellantUserId` (the member's own view),
and the unique `flagId`.

`scope` is **stored rather than derived** on purpose. `scopeForFlag` reads
`event.source` to decide whether an event flag touched standing, and the content
row can be deleted after the appeal is filed — an appeal whose scope becomes
unresolvable is an appeal that cannot be granted. Stamping it at file time makes
the record self-sufficient.

`src/lib/config.ts` — `standingScopes = ['community_event', 'suggestion']`,
client-safe and imported by the schema by relative path, matching
`suggestionCategories` and `volunteer.ts`.

`src/lib/server/db/schema/notification.ts` — two types:

- **`moderation_appeal_filed`** (staff) — in-app only, same reasoning as
  `community_event_submitted` and `volunteer_hours_submitted`: a queue item, not
  news.
- **`moderation_appeal_decided`** (member) — email + in-app, same reasoning as
  `suggestion_moderated`: the member asked a question and is waiting. Silence
  here reads as being ignored, which is the specific harm this feature exists to
  prevent. The staffer's notes ride in the email body as a quote, since a
  decision without a reason is the thing members write in about.

No changes to `content_flag`, `community_event_standing`, or
`suggestion_standing`. Migrations are generated by the maintainer with
`pnpm db:generate`.

## Permissions

| Who                   | Can                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------- |
| Signed out            | Nothing                                                                                |
| Any member            | File one appeal per upheld flag against **their own** content; read their own appeals  |
| Staff / admin         | Read the appeal queue; decide any appeal they did not resolve; reopen a decided appeal |
| The resolving staffer | Everything above, **except denying** the appeal against their own resolution           |

Every handler in `src/lib/remote/appeals.remote.ts` opens with `requireUser()` or
`requireStaff()`. Remote functions bypass route and layout loads entirely, so
these are the only guard — the pattern `suggestions.remote.ts` and
`community-events.remote.ts` already follow.

**The member never passes a flag id.** Filing is keyed to the standing record —
"appeal the decision that put me on review" — and the service reads
`triggeringFlagId` itself after confirming the standing belongs to the caller.
There is nothing to enumerate, because there is no id the member could guess at.

The identity block is enforced in the **service**, not the UI. The staff page
disables the deny control and says why, but a hand-rolled request from the
resolving staffer is rejected by `decideAppeal` with a message naming the rule.
The UI state is a courtesy; the service is the rule.

`admin` and `staff` are the same authorization here as everywhere
(`docs/specs/admin-vs-staff-spec.md`). Nothing in this feature depends on the
distinction, and the reviewer rule deliberately does not try to build one out of
it.

## Surfaces

**No new routes.** An appeal is a small object attached to a decision, and both
sides already have a page where that decision is explained.

| Route                        | What changes                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| `/member/suggestions`        | The probation banner gains **Appeal this decision** (form modal), then pending state and outcome   |
| `/member/events`             | Same, on the standing banner there                                                                 |
| `/member/suggestions/[id]`   | The withheld/hidden `Alert` links to the banner's appeal when the member is also on review         |
| `/member/events/[id]/manage` | Same, on the takedown notice that already renders `reviewNotes`                                    |
| `/staff/flags/[id]`          | The appeal renders beside the Resolution card: the member's argument, then the decide form         |
| `/staff/flags`               | An **Appealed** filter, and a **new** badge on the Content Flags nav item counting pending appeals |
| `/staff/users/[id]`          | The two standing cards show "appeal pending" where one is open, linking to the flag                |

The member-side placement follows from the scope. The appeal is about standing,
so it lives on the standing banner — the surface that says "you are on review" is
the surface that offers a way to contest it. The content pages only cross-link,
because a member reading a takedown notice is often the person who wants to
appeal but is looking at the wrong thing; the link says which decision the appeal
would actually be about.

`standing.triggeringFlagId` is what makes this work — it is already stored on both
standing tables for exactly this "why am I in review?" purpose, and it is the flag
the appeal attaches to.

A dedicated `/staff/appeals` was considered and rejected. The suggestion board
argued for a list-plus-detail pair because its notification needed a stable
`href` and a merged post needed a landing page. Neither applies: the appeal's
stable href is `/staff/flags/[id]`, which exists, and putting the appeal anywhere
else would undo the reason for attaching it to the flag in the first place.

The nav badge is genuinely new — `Nav.Item href="/staff/flags"` carries none
today, unlike Suggestions with its `layout.suggestionsAwaiting`. It counts
_pending appeals_, not pending flags: an unresolved report is work staff chose the
pace of, while an appeal is somebody waiting on an answer they were promised.

All controls are `form()`-backed and driven by `<Form>` / `<Action>` per
`docs/development/ui-patterns.md`; filing is a form modal, per "create forms live
in modals".

## Dev testing

`scripts/seed-dev.ts` should leave every state reachable without clicking through
a moderation flow first:

- an **upheld suggestion flag with a pending appeal**, so the staff decide form
  has something in it on a fresh seed
- an **upheld community-listing flag with a pending appeal**, so both scopes are
  exercised
- a **granted** appeal and a **denied** one, so both terminal states render on the
  member side
- a pending appeal whose flag was resolved by the **seeded staff account you log
  in as**, so the disabled deny control and its explanation are on screen without
  staging a second staffer

Then, by hand:

1. Report another member's suggestion, uphold it, and confirm the author lands on
   review with the suggestion hidden.
2. As that member, appeal from the banner on `/member/suggestions`; confirm the
   banner still says they are on review — **nothing pauses** is the property most
   likely to be quietly broken.
3. Confirm a second appeal against the same decision is refused.
4. As the staffer who upheld the report, confirm deny is disabled with the reason
   shown, and that **grant still works**.
5. As a different staffer, deny a different appeal; confirm the member's email
   carries the notes.
6. Grant one, and confirm `/staff/users/[id]` shows the member off review without
   anyone having touched the Restore posting trust button — the automatic restore
   is the feature's whole reason for existing.
7. Reopen a denied appeal and confirm it returns to the queue.

Service tests in `appeal-service.spec.ts`, in the register of
`flag-service.spec.ts` — that file is the executable form of the moderation rules
and this is its counterpart: filing requires that the standing belongs to the
caller; the unique index refuses a second appeal; granting calls `restoreStanding`
for the right scope; the resolving staffer is refused a denial and permitted a
grant; a deleted resolver frees the appeal; and the effect-before-stamp ordering
holds. `e2e/` covers the round trip a unit test cannot — that a decision reaches
the member as written English with its reason attached.
