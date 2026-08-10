---
title: Reviewing Volunteer Hours
slug: review-volunteer-hours
category: volunteering
summary: Working the approval queue, managing roles, and pulling the report for the board.
minRole: staff
sortOrder: 2
---

## The queue

**Volunteering** in the staff panel opens on the **Pending** tab, which is the
work: hours members have logged and nobody has looked at yet. The count in the
sidebar is how many are waiting.

For each log you get the member, the role, the date, the hours, and their
description of what they did. Approve or reject from the row.

- **Approve** takes an optional note, shared with the member.
- **Reject** requires a reason. The member cannot correct and resubmit without
  one, so say what was wrong — wrong duration, duplicate, not volunteer time.

Review is one-way. If you approve something by mistake, ask the member to submit
a corrected log; there is no un-approve.

Filters (member, role, date range) stay in the URL, so a reload or a back button
keeps your view.

## Managing roles

**Volunteering → Roles** is the list members pick from. A role is a name plus a
job description in markdown — the description is what members read when deciding
whether to help, so write what the job actually involves rather than a label.

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
