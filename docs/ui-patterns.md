# UI Patterns Reference

When building or modifying pages in this app, use the shared components and patterns described here. Every page should compose from these building blocks so the UI stays consistent.

## Page structure

Every page under a panel layout (staff, member, or band) follows this shape:

```svelte
<PageHeader title="Page Title" subtitle="Panel">
  <!-- optional right-side actions (SubmitButton, links, etc.) -->
</PageHeader>

<!-- page content -->
```

Always use `<PageHeader>` for the page title. Never write a bare `<h1>`.

### Loading and error states

The panel layouts (`member/+layout.svelte`, `staff/+layout.svelte`, `band/[slug]/+layout.svelte`) wrap `{@render children()}` in a `<svelte:boundary>` with default pending (spinner) and failed (Alert with Retry) snippets. Pages **do not** need to add their own boundary, pending, or failed snippets — the layout handles it.

If a page needs a custom boundary (e.g. wrapping only a subsection), it can still use `<svelte:boundary>` locally — the innermost boundary wins.

## Remote functions (data.remote.ts)

Pages that have forms or dynamic queries use a colocated `data.remote.ts` file with SvelteKit's `query()` and `form()` from `$app/server`. This replaces `+page.server.ts` load/actions for pages that use the `Form` component.

```typescript
import { z } from 'zod';
import { query, form, getRequestEvent } from '$app/server';

// Read-only data
export const getItems = query(z.string(), async (param) => {
  // ...
  return { items };
});

// Mutations with validation
export const saveItem = form(schema, async (data) => {
  // getRequestEvent() for auth/params
  // return result (client gets it via remote.result)
});
```

When rendering multiple forms from the same remote form function, use `.for(key)` to create separate instances:

```svelte
{#each items as item (item.id)}
  {@const instance = saveItem.for(item.id)}
  <Form remote={instance} ...>
```

## Form component

`Form` wraps a remote form with dirty tracking, unsaved-changes guard, status management, and toast notifications. It replaces `use:enhance`.

```svelte
<Form
  remote={saveItem}
  successToast="Saved"
  errorToast="Save failed"
  onsuccess={(result) => { /* navigate, refresh, etc. */ }}
>
  <FormField name="name" type="text" value={item.name} />
  <FormField name="email" type="email" value={item.email} />
  <SubmitButton label="Save" class="btn-primary" />
</Form>
```

Props:
- `remote` — a remote form from `data.remote.ts`
- `successToast` / `errorToast` — toast messages
- `onsuccess` / `onfailure` — callbacks

### How dirty tracking works

Dirty tracking is bottom-up. Each `FormField` listens for `input` and `change` events (via event delegation on its wrapper) and notifies the `FormContext`. The Form's status moves from `idle` → `dirty` when any field fires a change. `SubmitButton` is disabled until the form is dirty, and `FormGuard` blocks navigation while there are unsaved changes.

This means any input nested inside a `FormField` — whether it's a built-in type or custom markup via the `children` snippet — participates in change tracking automatically. No extra wiring needed.

## FormField component

Wraps the label + error + input triple that repeats on every form. Use this instead of manually writing `div.form-control > label + error loop + input`.

### Built-in input mode (preferred)

When FormField knows the input type, it renders the input itself:

```svelte
<FormField name="email" type="email" label="Email address" value={item.email} />
<FormField name="bio" type="textarea" value={item.bio} />
<FormField name="role" type="select" options={roleOptions} value={item.role} />
<FormField name="active" type="toggle" value={item.active} checkboxLabel="Active" />
```

### Custom input mode

For inputs FormField can't render (date pickers, file uploads, compound inputs), pass markup as children. Event delegation on the wrapper handles change tracking automatically — no manual wiring needed:

```svelte
<FormField name="startDate" label="Start date">
  <MyDatePicker name="startDate" value={item.startDate} />
</FormField>
```

### Key props

- `name` — **required inside a Form**. Must match the field name in the remote form's Zod schema. This is how FormField looks up validation issues from the Form context and how the value is submitted.
- `label` — field label text. Auto-derived from `name` if omitted.
- `type` — input type for built-in rendering: `text`, `email`, `tel`, `number`, `password`, `textarea`, `select`, `tags`, `checkbox`, `toggle`
- `value` — current value (for built-in inputs)
- `description` — help text shown below the label when there are no validation errors
- `readonly` — disables the input and shows a read-only display
- `class` — extra classes on the wrapper fieldset
- `issues` — only needed when using FormField **outside** a `<Form>`. Inside a Form, issues are pulled from the form context automatically using `name`.

## SubmitButton

Status-aware submit button that reads from `FormContext`. Shows spinner while pending, checkmark on success, X on error.

```svelte
<SubmitButton
  label="Save"
  successLabel="Saved"
  errorLabel="Error"
  class="btn-primary"
  disabled={!isValid}
  shortcut="mod+s"
/>
```

Place inside a `<Form>`. For standalone async actions (not inside a form), use `AsyncButton` instead.

## AsyncButton

Same status feedback as SubmitButton but for standalone async actions that aren't part of a form. For actions that need a confirmation step or a form modal, use `Action` instead.

```svelte
<AsyncButton
  action={() => deleteItem(item.id)}
  label="Delete"
  successToast="Deleted"
  class="btn-error btn-sm"
/>
```

## Action

A single component that handles four patterns depending on its props: direct async action, confirmation dialog, callback modal, or form modal. Detects the mode from the `action` prop and presence of `body`/`confirm`.

### Direct action

Runs an async callback on click. Same behavior as `AsyncButton`.

```svelte
<Action action={() => archive(item.id)} label="Archive" successToast="Archived" class="btn-sm" />
```

### With confirmation

When `confirm` is set (and no `body`), an alert dialog is shown before firing the callback:

```svelte
<Action
  action={() => deleteItem(item.id)}
  label="Delete"
  class="btn-error btn-sm"
  confirm="This will permanently delete the item. Are you sure?"
  successToast="Deleted"
/>
```

### Callback modal

When `action` is a callback and `body` is provided, clicking the button opens a modal with custom content and a submit button that calls the callback. Use this for create flows backed by `command()` or any async function that needs user input first.

```svelte
<Action
  action={() => createAudience({ name, slug, description })}
  label="New Audience"
  modalTitle="Create Audience"
  canSubmit={!!name.trim()}
  successToast="Created"
  onsuccess={(result) => goto(`/staff/marketing/audiences/${result.id}`)}
>
  {#snippet body({ close })}
    <FormField name="name" label="Name" type="text" bind:value={name} />
    <FormField name="slug" label="Slug" type="text" bind:value={slug} />
  {/snippet}
</Action>
```

The body snippet receives `{ close }` so the parent can programmatically close the modal if needed. The `canSubmit` prop gates the submit button.

### Form modal

When `action` is a `RemoteForm` (from `form()` in `data.remote.ts`), clicking the button opens a modal with a `<Form>` wrapper. Provide the form fields via the `body` snippet. The modal includes a built-in `SubmitButton` and closes on success.

```svelte
<Action
  action={updateItem}
  label="Edit"
  class="btn-primary btn-sm"
  modalTitle="Edit Item"
  successToast="Updated"
  onsuccess={() => invalidateAll()}
>
  {#snippet body({ close })}
    <FormField name="name" type="text" value={item.name} />
    <FormField name="description" type="textarea" value={item.description} />
  {/snippet}
</Action>
```

For `.for()` instances (per-row actions in a list):

```svelte
{#each items as item (item.id)}
  <Action action={updateItem.for(item.id)} label="Edit" modalTitle="Edit {item.name}" ...>
    {#snippet body({ close })}
      <FormField name="name" type="text" value={item.name} />
    {/snippet}
  </Action>
{/each}
```

### Mode detection

| `action` type | `body` | `confirm` | Mode |
|---|---|---|---|
| callback | — | — | Direct action |
| callback | — | string | Confirmation dialog |
| callback | snippet | — | Callback modal |
| RemoteForm | snippet | — | Form modal |

### Props

- `action` — async callback `() => Promise<any>` or a `RemoteForm` from `form()`
- `label` — button text (also used as default submit label in modals)
- `icon` — optional icon snippet on the trigger button
- `confirm` — string message for the confirmation dialog (callback mode, no body)
- `modalTitle` — title for the modal (callback modal and form modal modes)
- `body` — snippet rendered inside the modal. Receives `{ close }` as params. In form-modal mode, wrapped in a `<Form>`. In callback mode, rendered as-is.
- `submitLabel` — override the submit button label in the modal (defaults to `label`)
- `canSubmit` — boolean that gates the submit button in callback modal mode (default `true`). Ignored in form-modal mode where Zod handles validation.
- `maxWidth` — modal width class (default `'max-w-lg'`)
- `successToast` / `errorToast` — toast messages
- `onsuccess` / `onfailure` — callbacks
- `class` — button classes (default `btn-primary`)
- `disabled` — disables the trigger button

## StatusBadge

Renders a daisyUI badge colored by status string. Handles underscore-to-space conversion automatically.

```svelte
<StatusBadge status={reservation.status} />
<!-- renders: <span class="badge badge-warning">scheduled</span> -->
```

Built-in variants: `scheduled` (warning), `confirmed` (info), `completed` (success), `no_show` (error), `cancelled` (ghost), `active` (success), `pending` (warning), `error` (error). Unknown statuses fall back to `badge-ghost`.

## Alert

DaisyUI alert banner for inline messages, errors, and warnings. Not to be confused with Bits UI's AlertDialog (which is used inside the `Action` component for confirmation dialogs).

```svelte
<!-- Simple message -->
<Alert type="success">You've been subscribed!</Alert>

<!-- Inline error -->
<Alert type="error" class="text-sm">{errorMsg}</Alert>

<!-- With action button -->
<Alert type="warning">
  Member not found.
  {#snippet action()}
    <a href="/member/directory" class="btn btn-sm">Back to Directory</a>
  {/snippet}
</Alert>

<!-- As a link -->
<Alert type="info" href="/member/bands" class="shadow-sm">
  You have 3 pending band invitations.
</Alert>

<!-- With retry (used by layout boundary) -->
<Alert type="error" {reset}>Failed to load: {String(error)}</Alert>
```

Props: `type` (`info`, `warning`, `error`, `success`), `href` (renders as `<a>` instead of `<div>`), `reset` (adds a Retry button), `action` (snippet for custom action content), `class`.

## MemberLink

Displays a member's name (linked to their staff profile) and email. Optional avatar with initials.

```svelte
<MemberLink name={r.memberName} email={r.memberEmail} userId={r.createdByUserId} avatar />
```

Without `userId`, the name renders as plain text. Without `avatar`, only name + email are shown.

## BookerTypeIcon

Maps a `bookerType` string to the appropriate icon (user or event).

```svelte
<BookerTypeIcon type={reservation.bookerType} size={16} class="text-base-100" />
```

Change the icon mapping here when the icon set changes.

## TabBar

Tab navigation supporting both URL-driven (links) and client-state (buttons) modes.

```svelte
<!-- URL-driven -->
<TabBar
  tabs={[
    { key: 'upcoming', label: 'Upcoming', badge: 12, href: '/reservations?tab=upcoming' },
    { key: 'all', label: 'All', badge: 50, href: '/reservations?tab=all' }
  ]}
  active={data.tab}
/>

<!-- Client-state -->
<TabBar
  tabs={[{ key: 'upcoming', label: 'Upcoming' }, { key: 'past', label: 'Past' }]}
  active={activeTab}
  onchange={(key) => (activeTab = key)}
/>
```

Tabs with `href` render as `<a>` tags; without, they render as `<button>` tags and call `onchange`.

## CopyableId

Truncated ID display with a clipboard copy button. Useful for Stripe IDs, record IDs, etc.

```svelte
<CopyableId value={record.stripePaymentRecordId} label="Stripe record" />
```

IDs longer than 16 characters are automatically truncated to `first10...last4`.

## RecordNav

Prev/next navigation arrows with keyboard shortcuts (← →). Includes `<svelte:window>` listener.

```svelte
<RecordNav
  prevHref={data.prevId ? `/staff/reservations/${data.prevId}` : undefined}
  nextHref={data.nextId ? `/staff/reservations/${data.nextId}` : undefined}
  endLabel="Last of the day"
/>
```

When `nextHref` is absent, shows `endLabel` (if provided) or a disabled button.

## InfoCard

Card with a small label header and content body. Use for detail page sections (member info, payment, notes, etc.).

```svelte
<InfoCard title="Payment">
  <p class="text-2xl font-medium">$24.00</p>
</InfoCard>
```

Pass extra classes on the outer card via `class`:

```svelte
<InfoCard title="Cancelled" class="border-l-4 border-error">
  <p>Reason: scheduling conflict</p>
</InfoCard>
```

## DayTimeline

Horizontal bar showing a day's reservations from 9am–10pm. Highlights one "current" slot in primary and shows others in secondary.

```svelte
<DayTimeline
  current={{ id: 'abc', startsAt: '...', endsAt: '...', bookerType: 'user' }}
  others={[
    { id: 'def', startsAt: '...', endsAt: '...', bookerType: 'event', label: 'Band Practice', href: '/staff/reservations/def' }
  ]}
/>
```

The `others` array is optional. Each slot's `href` makes it clickable; `label` shows on hover.

## EmptyState

Consistent empty-state message for lists and tables.

```svelte
{#if items.length === 0}
  <EmptyState message="No reservations found." />
{/if}
```

## DataTable

Table with built-in sorting and client-side pagination. Define columns as child `<Column>` components in the markup — each column declares its header, data key, and optional cell rendering.

```svelte
import DataTable from '$lib/components/shared/Table/DataTable.svelte';
import Column from '$lib/components/shared/Table/Column.svelte';

<DataTable data={users} empty="No users found">
  <Column key="name" header="Name" sortable />
  <Column key="email" header="Email" />
  <Column key="createdAt" header="Joined" sortable type="date" />
</DataTable>
```

### Column props

`key` (data property), `header` (label text), `sortable` (click-to-sort), `type` (built-in formatter: `text`, `date`, `datetime`, `currency`, `badge`), `class` (CSS on td), `shrink` (adds `w-px` for shrink-to-fit columns), `stopClick` (prevents row click propagation on this cell).

### Custom cell rendering

For complex cells (links, badges, compound elements), pass a `cell` snippet:

```svelte
<Column key="status" header="Status">
  {#snippet cell(value, row)}
    <StatusBadge status={row.status} />
  {/snippet}
</Column>
```

### MemberColumn

Domain component that renders a `MemberLink` in a table cell. Handles the padding, click propagation, and link behavior automatically.

```svelte
import MemberColumn from '$lib/components/shared/Table/MemberColumn.svelte';

<MemberColumn nameKey="userName" emailKey="userEmail" userIdKey="userId" />
```

Props: `nameKey` (default `"userName"`), `emailKey`, `userIdKey`, `header` (default `"Member"`), `sortable`, `avatar`.

### Row navigation

Make rows clickable with `rowHref`:

```svelte
<DataTable data={reservations} rowHref={(r) => `/staff/reservations/${r.id}`}>
  <!-- columns -->
</DataTable>
```

Uses SvelteKit's `goto` for client-side navigation. Cells with `stopClick` opt out of row clicks (useful for MemberColumn or action buttons).

### Grouping

Group rows by a label with `groupBy`:

```svelte
<DataTable data={reservations} groupBy={(r) => formatDate(r.startsAt)}>
```

### Toolbar (filters)

DataTable can host a filter bar via the `toolbar` snippet. It wraps the content in a `<form method="get">` with a Filter button and a conditional Clear link.

```svelte
import * as Filter from '$lib/components/shared/Table/Filter';

<DataTable data={bands} clearHref="/staff/bands" empty="No bands found">
  {#snippet toolbar()}
    <Filter.Search name="q" value={data.filters.search} placeholder="Search by name..." />
    <Filter.Select name="status" value={data.filters.status} placeholder="All statuses"
      options={[['active', 'Active'], ['deactivated', 'Deactivated']]} />
  {/snippet}
  <Column key="name" header="Name" sortable />
</DataTable>
```

The Clear link appears automatically when any `[data-filter]` element has a value and hides otherwise. Hidden inputs (for sticky params like `tab`) don't trigger the Clear link.

For extra toolbar content that isn't a filter (hidden inputs, custom markup), place it directly in the snippet — only elements with `data-filter` affect the Clear link visibility:

```svelte
{#snippet toolbar()}
  <input type="hidden" name="tab" value={data.tab} />
  <Filter.Search name="q" value={data.search} />
  <Filter.Date name="from" value={data.dateFrom ?? ''} />
  <Filter.Date name="to" value={data.dateTo ?? ''} />
{/snippet}
```

#### Filter helpers

All three render a single styled input with the `data-filter` attribute.

- **`Filter.Search`** — text input. Props: `name` (default `"q"`), `value`, `placeholder` (default `"Search..."`), `class` (default `"w-48"`).
- **`Filter.Select`** — select dropdown. Props: `name`, `value`, `placeholder` (default `"All"`), `options` (accepts `string[]`, `[value, label][]`, or `{ value, label }[]`), `class`. String arrays auto-convert underscores to spaces in labels.
- **`Filter.Date`** — date input. Props: `name`, `value`, `class`.

### Pagination

Built in, default 20 rows per page. Customize with `pageSize`. Controls only render when there are multiple pages.

### Legacy API

The old `columns` prop + `row` snippet API still works for backward compat but new pages should use `<Column>` components.

## StatCard

Single stat display for dashboards.

```svelte
<StatCard title="Total Users" value={stats.userCount} />
```

## Pagination

Page navigation for lists. Only renders when `totalPages > 1`.

```svelte
<Pagination page={currentPage} totalPages={total} buildHref={(p) => `?page=${p}`} />
```

## TagInput

Multi-select combobox with search, badge display, and hidden `<select>` for form submission.

```svelte
<TagInput
  options={roleOptions}
  value={selectedRoleIds}
  name="roles"
  placeholder="Search roles..."
/>
```

## PageHeader

Page title with optional back button, subtitle, and right-side action slot.

```svelte
<PageHeader title="Edit User" subtitle="Staff" backHref="/staff/users">
  <SubmitButton shortcut="mod+s" />
</PageHeader>
```

## Create forms live in modals

"Create" flows (new reservation, new event, etc.) should open in a modal on the list page, not navigate to a separate `/new` route. This keeps the user in context and avoids a full page transition for what's usually a short form. The modal is a sibling component to the list page (e.g. `CreateModal.svelte`) and is toggled by a button in the `PageHeader`.

Edit/detail views remain full pages at `[id]/`.

## CSS conventions

- Use bare daisyUI component classes. Extra Tailwind overrides are fine for spacing on parents but avoid overriding component internals.
- Cards: `card bg-base-100 shadow` (use `shadow` not `shadow-sm`).
- Form inputs: `input input-bordered` (standard size). Use `input-sm` only on dense settings-style forms, and be consistent within a page.
- Page content width: constrain with `max-w-md` (forms), `max-w-2xl` (settings), or let it fill (tables/dashboards).
- Spacing between sections: `space-y-6` on the page content wrapper.

## Component locations

All shared components live in `src/lib/components/`. Panel-specific layout components are in subdirectories (`staff/`, `member/`). Feature-specific components that are only used on one page live alongside that page or in a feature subdirectory under `member/`.
