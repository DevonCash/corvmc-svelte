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

Card-wrapped table backed by `@humanspeak/svelte-headless-table`. Accepts column definitions and data; handles sorting and client-side pagination automatically.

Define columns using the `Column<T>` type from `$lib/components/DataTable.svelte`:

```typescript
import type { Column } from '$lib/components/DataTable.svelte';

const columns: Column<User>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'email', header: 'Email' },
  {
    key: 'createdAt',
    header: 'Joined',
    sortable: true,
    cell: (v) => new Date(v as string).toLocaleDateString()
  }
];
```

Column options: `key` (property on data object), `header` (label text), `sortable` (enables click-to-sort), `cell` (formats the value as text), `class` (extra CSS on the `<td>`).

For simple text-only cells, the `cell` formatter or raw value is rendered automatically:

```svelte
<DataTable data={users} {columns} empty="No users found" />
```

For complex cells (links, badges, multiple elements), pass a `row` snippet to take full control of row rendering:

```svelte
<DataTable data={users} {columns} empty="No users found">
  {#snippet row(user)}
    <tr class="hover">
      <td><a href="/staff/users/{user.id}" class="link link-primary">{user.name}</a></td>
      <td>{user.email}</td>
      <td>{new Date(user.createdAt).toLocaleDateString()}</td>
    </tr>
  {/snippet}
</DataTable>
```

When using the `row` snippet, you're responsible for rendering all `<td>` elements in column order. The `columns` prop still drives the header row and sorting behavior.

Pagination is built in (default 20 rows per page). Customize with `pageSize`:

```svelte
<DataTable data={users} {columns} pageSize={50} />
```

Pagination controls only render when there are multiple pages.

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
