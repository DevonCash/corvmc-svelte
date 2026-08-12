---
title: Reviewing Volunteer Hours
slug: review-volunteer-hours
category: volunteering
summary: Scheduling shifts, working the approval queue, finding volunteers, managing roles and clearances, and pulling the report.
minRole: staff
sortOrder: 2
---

## The queue

**Volunteering** in the staff panel opens on the **Pending** tab, which is the
work: hours members have logged and nobody has looked at yet. The count in the
sidebar is how many are waiting.

For each log you get the member, the role, the date, the hours, and their
description of what they did. Approve or return from the row.

- **Approve** takes an optional note, shared with the member.
- **Return** requires a reason. The member cannot correct and resubmit without
  one, so say what was wrong — wrong duration, duplicate, not volunteer time.

Review is one-way. If you approve something by mistake, ask the member to submit
a corrected log; there is no un-approve.

Filters (member, role, date range) stay in the URL, so a reload or a back button
keeps your view.

## Scheduling shifts

**Volunteering → Shifts** is the roster. Create a shift from a role (times and
headcount prefill from the role's defaults), and duplicate it forward to make a
standing weekly slot — there is no recurrence to configure. Members claim from
their volunteering page; you confirm claimants on the shift's detail page, and
only confirmed people get the day-before reminder and auto-complete afterwards.
Mark no-shows there too — a no-show is different from a cancellation, and only
one of them is worth remembering next time.

A role can require certifications (**Volunteering → Certifications**) before its
shifts can be claimed. Requirements are checked against the shift's date, so a
lapsing card is caught before it matters. The clearances view shows who is
current, expiring soon, or lapsed. Grant and revoke from the member's page —
revoking keeps the record of the period it covered, which is the point.

The day after a shift, workers get a two-question survey. Responses show on the
shift detail and roll up per role on the report, anonymously. A role scoring
badly on "were you set up to succeed?" is a briefing problem, not a volunteer
problem — fix the checklist, not the person.

## Finding someone to ask

**Volunteering → Interest** is the standing list of who has said they would help
and with what. Filter by role to answer "who can work the door on Saturday" — the
count beside each role in the filter tells you how deep the bench is before you
select it. Each row still shows every role that member picked, so you can see
at a glance whether you are about to ask the same three people again.

Expressing interest is not a commitment to a date, so treat the list as a place
to start asking, not a rota. **Copy emails on this page** puts the filtered
addresses on your clipboard for a quick message.

## Managing roles

**Volunteering → Roles** is the list members pick from. A role is a name plus a
job description in markdown — the description is what members read when deciding
whether to help, so write what the job actually involves rather than a label.

**Group** decides which of the three headings a role appears under — at shows,
away from shows, or committees. It is presentation only; nothing else depends
on it.

**Archive** a role you are not using. It disappears from the member's submit
form and stays everywhere else: existing logs keep working, the staff filter
still lists it, and the report still counts its hours. Archiving a role while
logs are in the queue is safe — you can still approve them.

**Delete** is only offered for a role nothing was ever logged against. That is
deliberate: deleting a role with history would quietly change past reports.
Archive is almost always what you want.

## The report

**Volunteering → Report** covers **approved hours only**, over whatever date
range you set (defaulting to this calendar year). It gives you:

- headline totals — hours, distinct volunteers, logs, average per volunteer;
- hours by member, sorted high to low;
- hours by role, with each role's share of the total;
- hours by month.

This is the shape a board packet or a grant application asks for. Approving is
what makes a number appear here, which is the reason the review step exists.
