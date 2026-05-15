# UI Patterns Reference

When building or modifying pages in this app, use the shared components and patterns described here. Every page should compose from these building blocks so the UI stays consistent.

## Page structure

Every page under a panel layout (staff or member) follows this shape:

```svelte
<svelte:boundary>
  <PageHeader title="Page Title" subtitle="Panel">
    <!-- optional right-side actions (SubmitButton, links, etc.) -->
  </PageHeader>

  <!-- page content -->

  {#snippet pending()}
    <div class="flex items-center justify-center p-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {/snippet}

  {#snippet failed(err, reset)}
    <div class="alert alert-error">
      <p>Failed to load: {String(err)}</p>
      <button class="btn btn-sm" onclick={reset}>Retry</button>
    </div>
  {/snippet}
</svelte:boundary>
```

Use `<svelte:boundary>` whenever the page has async data (`$derived(await ...)`). The pending/failed snippets handle loading and error states.

Always use `<PageHeader>` for the page title. Never write a bare `<h1>`.

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
  initial={{ name: '', email: '' }}
  successToast="Saved"
  errorToast="Save failed"
  onsuccess={(result) => { /* navigate, refresh, etc. */ }}
>
  <!-- form fields -->
  <SubmitButton label="Save" class="btn-primary" />
</Form>
```

Props:
- `remote` — a remote form from `data.remote.ts`
- `initial` — object whose keys are tracked for dirty detection. Only include fields the user edits; hidden fields (like IDs) can be excluded to avoid false dirty state
- `successToast` / `errorToast` — toast messages
- `onsuccess` / `onfailure` — callbacks

The `Form` sets a `FormContext` that `SubmitButton` reads for status-driven rendering.

## FormField component

Wraps the label + error + input triple that repeats on every form. Use this instead of manually writing `div.form-control > label + error loop + input`.

```svelte
<FormField label="Email" id="email" issues={remote.fields.email.issues()}>
  <input
    id="email"
    name="email"
    type="email"
    value={item.email}
    class="input input-bordered"
  />
</FormField>
```

Props:
- `label` — field label text
- `id` — ties the label's `for` to the input's `id`
- `issues` — pass `remote.fields.<name>.issues()` for validation errors
- `class` — extra classes on the wrapper div

Works with any input type: `<input>`, `<select>`, `<textarea>`, `<TagInput>`, compound inputs with a hidden field, etc.

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

Same status feedback as SubmitButton but for standalone async actions that aren't part of a form.

```svelte
<AsyncButton
  action={() => deleteItem(item.id)}
  label="Delete"
  successToast="Deleted"
  class="btn-error btn-sm"
/>
```

## StatusBadge

Renders a daisyUI badge colored by status string. Handles underscore-to-space conversion automatically.

```svelte
<StatusBadge status={reservation.status} />
<!-- renders: <span class="badge badge-warning">scheduled</span> -->
```

Built-in variants: `scheduled` (warning), `confirmed` (info), `completed` (success), `no_show` (error), `cancelled` (ghost), `active` (success), `pending` (warning), `error` (error). Unknown statuses fall back to `badge-ghost`.

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
