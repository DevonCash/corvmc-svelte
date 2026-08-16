# Moderation Appeals — contesting an upheld report

## Purpose

When staff uphold a content report, the member on the receiving end loses two
things at once. The post comes down, and their future posts in that domain queue
for staff review before they publish. Both consequences are wired in one place —
`resolveFlag` in `src/lib/server/flag/flag-service.ts` — and neither can be
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
to the suggestion board (`d4df38c`), where "appealing a takedown" was written
into **Out of scope** with a pointer here.

## How it works

Before any table or column name: this is the whole feature in plain language.

Sam posts a gig listing on the community calendar. Someone reports it, a staffer
reads the report and agrees with it, and two things happen — the listing comes
off the public guide, and Sam's next listing will wait for a staffer before it
goes up. Sam gets an email saying so, with the staffer's note in it.

On that listing's page, underneath the note explaining what happened, there is
now a button: **Appeal this decision**. Sam writes a paragraph saying why they
think the call was wrong, and sends it. Nothing changes yet. The listing stays
down and Sam stays on review while this is being looked at. Sam can see that the
appeal is pending, and cannot file a second one about the same decision.

The appeal shows up on the staff report page, directly under the decision it is
contesting, so whoever picks it up reads the original report, the staffer's note,
and Sam's objection in one place, in that order, without going and finding
anything. The staff **Content Flags** nav item grows a count of appeals waiting —
it has never had one — so an appeal is not sitting on somebody happening to look.

Whoever answers it cannot be the staffer who made the original call. That button
is switched off for them, with the reason written next to it. They _can_ undo
their own decision if they have changed their mind — they just cannot be the one
who confirms it was right.

The answer is two separate questions, because in practice they come apart. Does
the listing go back up? Does Sam come off review? A staffer might well conclude
that the listing did break the rules but that a first offense does not warrant
probation — so "no" to the first and "yes" to the second. Whichever way they go,
it happens right there: saying Sam comes off review _is_ taking Sam off review.
Nobody has to remember a second button on a different page a week later.

Sam gets an email with the answer and the staffer's reasoning. If it was a no,
that is the end of it as far as Sam is concerned. Staff can reopen the appeal
later if something new turns up, but Sam cannot keep filing.

The states, in the same register:

```
        member files
  (none) ──────────────▶ pending ──staff decide──▶ decided
                            ▲                         │
                            └────staff reopen─────────┘
```

`decided` carries two independent answers — whether the content came back, and
whether the standing came back — so **partly granted** is a real outcome and not
a rounding of the other two. That independence is the point of the feature, not a
refinement of it: the two consequences of an upheld report are separate
judgements about separate things, and collapsing them would force a member to
argue the wrong case and a staffer to answer a question they were not asked.

## Scope

**In:**

- A member-filed appeal against an **upheld** (`resolved`) `content_flag` on
  their own community listing or suggestion.
- One appeal per decision, enforced in the schema; reopenable by staff.
- Two independent outcomes — the content and the standing — decided together in
  one form, applied immediately, with the standing restore wired to the outcome
  rather than left to a staffer's memory.
- A hard identity block: the staffer who resolved the flag cannot deny the
  appeal, though they may grant it.
- A `standing.ts` facade over the two existing standing tables, shaped like the
  scoped `member_standing` they will eventually become.
- Member entry points on the pages that already explain the decision, and a staff
  surface on the existing flag detail page. No new routes.

**Out (deliberately):**

- **Appealing a dismissed report.** Nothing was lost. The reporter has no
  standing to contest — their report was read and answered, which is all a report
  entitles anyone to.
- **Appealing a flag on a member or band profile.** Upholding one of those has no
  consequence today (see `resolveFlag`: only `event` and `suggestion` branches do
  anything), so there is nothing to contest. Adding appeals there would be a form
  that submits into a void.
- **Appealing a takedown with no report behind it.** Named as a gap rather than
  waved past — see Decisions.
- **A second-level appeal.** A denied appeal has been read by two people. A third
  is a committee, and the collective does not have one.
- **Any change to the report-filing side.** The griefing tradeoff recorded in
  `docs/specs/member-suggestions-spec.md` (one report hides a suggestion) is
  untouched here. This feature is downstream of it.
- **Merging `community_event_standing` and `suggestion_standing`.** Recommended,
  but as its own change — see Decisions.

## Decisions

### One appeal, two outcomes — not one appeal per consequence

An upheld report does two things, and staff should be able to answer them
separately. "The post did break the rules, but a first offense doesn't warrant
probation" is a coherent and probably common conclusion, and a design that cannot
express it forces the staffer into a decision they do not believe.

The alternative — two independent appeal objects, one against the takedown and
one against the standing change — was rejected on the member's side of the
transaction. It makes the member pick a legal theory before they are allowed to
object, and the member's actual state of mind is "I think you got this wrong,"
undifferentiated. It also doubles every downstream surface: two queues, two
notification types, two things to forget.

So: **one appeal, filed against the decision; two answers, given by staff.** The
member writes one paragraph. The staffer answers two questions. `contentOutcome`
and `standingOutcome` are separate columns for exactly this reason, and neither
is derivable from the other.

A third possibility — appealing only the standing, leaving takedowns final — was
rejected because for suggestions the takedown _is_ permanent (`hidden`, with no
member-side route back), so a member whose post was misread would have no way to
say so about the thing that actually happened to them.

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
message the member through the existing channel, and a moderation appeal that
needs three rounds of discussion is a conversation, not a form. If it turns out
to need threading, the appeal row is the right place to hang a thread id later.

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

The original resolver may grant an appeal — fully or partly — and may not deny
one. "I've thought about it and I was wrong" needs no second opinion; it costs
the collective nothing and the member benefits immediately. "I've thought about
it and I was right" is the judgement that needs somebody else, because it is the
one where the reviewer's interest and the member's diverge.

What this buys is that the deadlock only ever blocks the outcome the member has
no reason to want faster. An appeal that deserves to be granted can always be
granted by whoever is around, today. An appeal that deserves denial waits for a
second staffer — and while it waits, nothing about the member's situation is worse
than it was before they filed, because nothing pauses (below). A denial arriving
late is a denial arriving late.

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

The post stays down. The member stays on review. Filing an appeal changes the
member's situation not at all until it is decided.

The alternative — restoring standing for the duration — is kinder and is an
exploit. It hands anyone who has been put on review a way to take themselves off
it, for as long as the queue is slow, by objecting. The worse staff are at
keeping up, the better it works, which is exactly backwards: the mechanism is
strongest when the collective is least able to check it. Restoring the _content_
while pending is worse still, since it means a report upheld against genuinely
bad content is undone by its author objecting, inverting the moderation decision
on the say-so of the person it was made about.

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
**reopen** an appeal, which clears the decision columns and puts the row back to
pending. New information does turn up; a member who was wrongly moderated and
denied on a misunderstanding should not have their only remaining route be a
message thread — that is the failure this feature exists to fix, and it would be
perverse to reintroduce it at the one point where the stakes are highest.

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
The ceiling on total appeals per member is the number of times staff have upheld
a report against them — a number staff control, and one that is small for exactly
the members who would abuse it, because each one is a decision a staffer made
deliberately.

On top of that, `allowRateLimited` (`src/lib/server/rate-limit.ts`) at
5/hour/member on the file path, matching `flagSuggestion`. It is a velocity
backstop against a script, not the cap.

Does `allowRateLimited` cover it? Yes, with its documented caveat stated plainly:
KV is eventually consistent, so it is a soft throttle rather than a guarantee, and
its own docstring says to pair it with a stronger gate on public endpoints. This
endpoint is not public. Filing requires an authenticated member, an upheld flag,
and ownership of the content — three gates that a Turnstile would be a fourth
and unnecessary layer behind. The soft throttle is correctly sized here.

**No cap on open appeals.** An earlier draft had one, copied from
`MAX_OPEN_PORTAL_THREADS`. That cap protects a genuinely scarce resource — every
open portal thread is an unbounded conversation demanding a staffer's ongoing
attention. An appeal is one paragraph and one decision, and its count is already
bounded by the number of times staff have moderated the member. This is the same
reasoning `docs/specs/community-events-spec.md` used to reject a total listing
cap, and it lands the same way: the only person a cap reliably stops is the
member with several legitimate grievances.

### The takedown gap: appeals need a report to hang on

Attaching the appeal to the flag has a cost, and it should be written down rather
than discovered.

**Not every takedown has a flag behind it.** Staff can hide a suggestion directly
through `setVisibility` with no report involved, and a community listing can be
turned down into `rejected` from the review queue, which is a decision with a
required reason but no `content_flag` row. Neither is appealable under this
design, because there is no upheld report to anchor an appeal to.

This is a real gap, not a shrug. Two things make it tolerable now:

- A **rejected listing already has a member-side route** — the correct-and-
  resubmit loop `docs/specs/community-events-spec.md` was built around. Rejection
  notes are required and stored on `event.reviewNotes` precisely so a member can
  fix and resubmit. A member who disagrees rather than wanting to fix is the
  uncovered case.
- A **direct staff takedown of a suggestion costs no standing.** Only `resolveFlag`
  revokes trust. So the consequence with lasting weight — probation — is always
  behind a flag, and is always appealable.

The fix, when it is needed, is to give a flagless staff takedown a
`content_flag` row of its own — staff-reported, immediately resolved — so it
enters the same pipeline. That is deliberately not done here: it would mean
touching the report-creation path for every takedown to serve a case that has not
yet come up, and a synthetic report that nobody filed is a confusing thing to see
in a queue. Recorded so the next person knows it was a choice.

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
dynamic standing imports. Its behaviour is unchanged and
`flag-service.spec.ts` is the proof.

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
granting an appeal — which touches standing, content, and the appeal row — needs
an ordering where a crash leaves an obvious, re-runnable state. The house pattern
is the merge algorithm in `suggestion-service.ts`: **do the effects first, mark
the record last.**

```
1. restoreStanding(...)        if standingOutcome === 'restored'
2. restore the content         if contentOutcome === 'restored'
3. stamp the appeal decided    decidedAt / decidedBy / the two outcomes
```

Both restores are idempotent — `restoreCommunityTrust` is an unconditional
`SET requires_review = false`, and `setVisibility('visible')` is a write of a
known value, neither a read-modify-write. So a crash between any two steps leaves
an appeal that still reads **pending** with the remedy partly delivered: visible
in the queue, and repaired by clicking Grant again.

The reverse order is the one that must not be written. It would leave an appeal
displaying **granted** over a member still on probation — a state that looks
finished, notifies nobody, and is only discovered when the member writes in to
ask why nothing changed. That is the failure mode this whole feature exists to
remove, so reintroducing it as a crash artifact would be a particularly bad joke.

Step 2 is scoped by the flag's domain, and the two domains are not symmetric —
see below.

### Restoring content is not the inverse of taking it down

A suggestion restores cleanly: `setVisibility('visible')` puts back exactly what
was there, and the early-return on an unchanged visibility makes a re-run a
no-op.

A community listing does not, in two ways that must be surfaced in the staff UI
rather than discovered by the member.

**The poster is gone.** `unpublishWithNotice` deletes the R2 object for
`source === 'community'` and nulls `posterKey` — deliberately, and for a good
reason recorded in `docs/specs/community-events-spec.md`: poster URLs are
guessable and consult nothing, so leaving the image world-readable would make the
advertised kill switch not a kill switch. But it means the takedown is partly
**irreversible**. Granting a content appeal restores the listing's text, date and
venue; the artwork is unrecoverable and the member has to upload it again. The
grant confirmation says so, and the member's decision email says so, because
"your listing is back" followed by a silently poster-less listing is the kind of
small broken promise that costs more trust than the appeal won back.

**A restored listing lands in `draft`, not on the guide.** `unpublish` sets
`status = 'draft'`, so restoring means republishing. Routing that through the
ordinary publish path would produce a genuinely surprising result in the case the
split outcomes exist for: content restored, standing upheld. That path is
standing-aware — it lands a review-required member's listing in `pending_review`
— so granting the content half while denying the standing half would push the
listing into the staff queue instead of back onto the guide, and a staffer who
just decided it should be public would have to go approve it a second time.

So the appeal service **publishes directly**, bypassing the standing check. This
is safe and narrow: a staffer has just looked at this specific listing and said
it should be public, which is strictly more scrutiny than the review queue
applies. Standing continues to govern the member's _next_ listing, which is what
standing is for. Written down because the tempting refactor — "just call
`publishCommunityEvent`" — silently reintroduces the queue detour.

### `decidedAt IS NULL` is the pending predicate

The appeal has no `status` column. Pending is `decidedAt IS NULL` — one
predicate, hard to get wrong, in the spirit of the suggestion board's
`eq(visibility, 'visible')`.

The outcome label a human reads — Granted, Partly granted, Denied — is **derived**
from the two outcome columns, never stored, following the `merged` precedent in
`member-suggestions-spec.md`. A stored label is a third copy of a fact that two
columns already carry, and the only thing it can do is disagree with them.

Reopening is then `decidedAt = NULL` plus clearing the outcomes, which puts the
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
| `contentOutcome`           | `restored` / `upheld` / `not_applicable`; null while pending                             |
| `standingOutcome`          | `restored` / `upheld`; null while pending                                                |
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

`contentOutcome` carries `not_applicable` because there is frequently no takedown
to contest: an upheld event flag only unpublishes when staff tick
`unpublishEvent`, so a member can be on probation with their listing still live.
The service writes that value by checking the content's actual state at decision
time — it is not a choice the form offers, because a staffer should not be able
to record "we upheld the takedown" where no takedown happened.

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
`community-events.remote.ts` already follow, and the spec for it asserts every
one.

**The member never passes a flag id.** Filing is keyed to the content — "appeal
the decision about this suggestion" — and the service looks up the upheld flag
itself after confirming the member owns the content. There is nothing to
enumerate, because there is no id the member could guess at. Appealing a decision
that isn't theirs 404s rather than 403s: a 403 confirms the decision exists,
which is the same enumeration oracle `getSuggestionDetail` avoids.

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

| Route                        | What changes                                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `/member/suggestions/[id]`   | The existing withheld/hidden `Alert` gains **Appeal this decision** (form modal), then shows pending state and the outcome |
| `/member/events/[id]/manage` | Same, on the takedown notice that already renders `reviewNotes`                                                            |
| `/member/suggestions`        | The probation banner gains the same control, keyed to `standing.triggeringFlagId` — the standing-only case                 |
| `/member/events`             | Same, on the standing banner there                                                                                         |
| `/staff/flags/[id]`          | The appeal renders beside the Resolution card: the member's argument, then the decide form                                 |
| `/staff/flags`               | An **Appealed** filter, and a **new** badge on the Content Flags nav item counting pending appeals                         |
| `/staff/users/[id]`          | The two standing cards show "appeal pending" where one is open, linking to the flag                                        |

The nav badge is genuinely new — `Nav.Item href="/staff/flags"` carries none
today, unlike Suggestions with its `layout.suggestionsAwaiting`. It counts
_pending appeals_, not pending flags: an unresolved report is work staff chose the
pace of, while an appeal is somebody waiting on an answer they were promised.

The member-side placement is the whole reason this needs no new routes. A member
who has been moderated is already looking at the page that tells them so; the
appeal belongs in that notice, not behind a nav item they would have to know
exists. `standing.triggeringFlagId` is what makes the banner case work — it is
already stored on both standing tables for exactly this "why am I in review?"
purpose, and it is the flag an appeal from the banner attaches to.

A dedicated `/staff/appeals` was considered and rejected. The suggestion board
argued for a list-plus-detail pair because its notification needed a stable
`href` and a merged post needed a landing page. Neither applies: the appeal's
stable href is `/staff/flags/[id]`, which exists, and putting the appeal anywhere
else would undo the reason for attaching it to the flag in the first place.

All controls are `form()`-backed and driven by `<Form>` / `<Action>` per
`docs/development/ui-patterns.md`; the file-an-appeal flow is a form modal, per
"create forms live in modals".

## Dev testing

`scripts/seed-dev.ts` should leave every state reachable without clicking through
a moderation flow first — the states that are otherwise tedious to stage:

- an **upheld suggestion flag with a pending appeal**, so the staff decide form
  has something in it on a fresh seed
- an **upheld community-listing flag with a pending appeal** where the listing was
  _not_ unpublished, so `contentOutcome: not_applicable` renders
- a **partly granted** appeal — standing restored, takedown upheld — because that
  is the outcome a naive implementation collapses, and it should be visible at a
  glance rather than plausible
- a **denied** appeal, so the member-side terminal state renders
- a pending appeal whose flag was resolved by the **seeded staff account you log
  in as**, so the disabled deny control and its explanation are on screen without
  staging a second staffer

Then, by hand:

1. Report another member's suggestion, uphold it, and confirm the author lands on
   review with the suggestion hidden.
2. As that member, appeal from `/member/suggestions/[id]`; confirm the suggestion
   stays hidden and the banner still says they are on review — **nothing pauses**
   is the property most likely to be quietly broken.
3. Confirm a second appeal against the same decision is refused.
4. As the staffer who upheld the report, confirm deny is disabled with the reason
   shown, and that **grant still works**.
5. As a different staffer, deny it; confirm the member's email carries the notes.
6. Grant a different appeal with standing restored and content upheld; confirm
   `/staff/users/[id]` shows the member off review while the post stays down —
   the automatic restore is the feature's whole reason for existing.
7. Reopen a denied appeal and confirm it returns to the queue.
8. Take down a community listing **that has a poster**, appeal it, and grant the
   content half while denying the standing half. Two things to check, both of
   them the asymmetries above: the listing is back on the public guide rather
   than sitting in the review queue, and both the staff confirmation and the
   member's email said the poster was not coming back.

Service tests in `appeal-service.spec.ts`, in the register of
`flag-service.spec.ts` — that file is the executable form of the moderation rules
and this is its counterpart: filing requires ownership of the content; the unique
index refuses a second appeal; granting calls `restoreStanding` for the right
scope; the resolving staffer is refused a denial and permitted a grant; a
deleted resolver frees the appeal; the effects-before-stamp ordering holds; and a
content grant publishes directly rather than through the standing-aware path.
`e2e/` covers the round trip a unit test cannot — that a decision reaches the
member as written English with its reason attached.
