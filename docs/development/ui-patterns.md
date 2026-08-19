# UI Patterns Reference

When building or modifying pages in this app, use the shared components and patterns described here. Every page should compose from these building blocks so the UI stays consistent.

> Testing these components in isolation (stories vs. specs, mocking the server)? See [component-testing.md](./component-testing.md).

> Reducing the raw utility classes still left in page templates? See
> [template-audit.md](./template-audit.md) for the census, the findings, and the migration phases.

## Page structure

Every page under a panel layout (staff, member, or band) follows this shape:

```svelte
<PageHeader title="Page Title" subtitle="Panel">
	<!-- optional right-side actions (SubmitButton, links, etc.) -->
</PageHeader>
<PageContent width="full">
	<!-- page body -->
</PageContent>
```

Always use `<PageHeader>` for the page title. Never write a bare `<h1>`.

### PageContent

Wraps the page body with consistent vertical spacing (`space-y-6`) and optional width constraint. PageHeader always sits **outside** PageContent so it keeps full-bleed behavior.

```svelte
import PageContent from '$lib/components/shared/PageContent.svelte';
```

Props:

- `width` — `'full'` (default), `'md'`, `'2xl'`, or `'3xl'`. Adds `max-w-*` + `mx-auto`.
- `class` — extra classes on the wrapper div.

#### Standard page (full-width)

```svelte
<PageHeader title="Users" subtitle="Staff" />
<PageContent>
	<FilterBar ... />
	<DataList {result} onpage={(p) => (page = p)}>
		{#snippet children(rows)}
			<Table>...</Table>
		{/snippet}
	</DataList>
</PageContent>
```

#### Constrained detail page

```svelte
<PageHeader title={item.name} subtitle="Equipment" backHref="/staff/equipment" />
<PageContent width="3xl">
	<InfoCard title="Details">...</InfoCard>
</PageContent>
```

#### Form-wrapping page (save button in header)

When `<Form>` must wrap both the header (for SubmitButton) and the body fields, place PageContent inside the Form:

```svelte
<Form remote={updateItem} successToast="Saved">
	<PageHeader title={item.name}>
		<SubmitButton />
	</PageHeader>
	<PageContent width="3xl">
		<InfoCard title="Info">
			<Field name="name" ... />
		</InfoCard>
	</PageContent>
</Form>

<!-- Non-form content gets its own PageContent -->
<PageContent width="3xl">
	<InfoCard title="History">...</InfoCard>
</PageContent>
```

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

> **Rule:** All forms in route files (`+page.svelte`) must use `Form`, `FormField`, and `SubmitButton`. Never use raw `<form>`, `<input>`, `<select>`, or manual submit handlers directly in page files — even for small inline forms.

`Form` wraps a remote form with dirty tracking, status management, and toast notifications. It replaces `use:enhance`. Unsaved-changes protection is opt-in via the `guard` prop — add it to edit/settings forms where losing changes would be frustrating, but leave it off for login, modal, and quick-action forms.

```svelte
<Form
	remote={saveItem}
	successToast="Saved"
	onfailure={() => toast.error('Save failed')}
	onsuccess={(result) => {
		/* navigate, refresh, etc. */
	}}
>
	<FormField name="name" type="text" value={item.name} />
	<FormField name="email" type="email" value={item.email} />
	<SubmitButton label="Save" class="btn-primary" />
</Form>
```

Props:

- `remote` — a remote form from `data.remote.ts`
- `guard` — enables unsaved-changes protection (blocks navigation when form is dirty)
- `successToast` — toast message shown after a successful submit
- `onsuccess` / `onfailure` — callbacks
- `flashDuration` — how long the success/error flash sticks before the button
  returns to its idle state (default 1500ms)

There is **no `errorToast` prop.** Passing one does nothing visible — it falls
through the rest spread onto the `<form>` element. The default error handling is
built in: a validation failure toasts "Please fix the highlighted fields and try
again.", and a thrown error is reported to Sentry via the nearest
`ErrorToastBoundary`. Supply `onfailure` to replace that with your own message —
note that doing so suppresses the default toast.

Toasts are rendered by the `<Toaster>` inside `AppShell`, so they only appear on
panel routes (member/staff/band). A `toast.*` call from a `(public)` route or the
login page is silently dropped.

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

`FormField` with `type="textarea"` spreads only its own input props, so `rows`, `placeholder` and `maxlength` are **silently dropped** on that branch. Use custom input mode for a textarea that needs any of them.

### Key props

- `name` — **required inside a Form**. Must match the field name in the remote form's Zod schema. This is how FormField looks up validation issues from the Form context and how the value is submitted.
- `label` — field label text. Auto-derived from `name` if omitted.
- `type` — input type for built-in rendering: `text`, `email`, `tel`, `number`, `password`, `textarea`, `select`, `tags`, `checkbox`, `toggle`
- `value` — current value (for built-in inputs)
- `description` — help text shown below the label when there are no validation errors
- `readonly` — disables the input and shows a read-only display
- `class` — extra classes on the wrapper fieldset
- `issues` — only needed when using FormField **outside** a `<Form>`. Inside a Form, issues are pulled from the form context automatically using `name`.

## Button

Variant, size and shape are **props**, never class strings. `class` is reserved for genuine
one-offs — positioning, a `join-item`, a bespoke skin.

```svelte
<Button variant="ghost" size="sm">Cancel</Button>
<Button variant="error" outline size="sm">Delete</Button>
<Button variant="ghost" size="sm" shape="square" title="Edit"><IconPencil size={16} /></Button>
<Button href="/staff/users">All users</Button>
```

Props:

- `variant` — `primary` (default), `secondary`, `accent`, `neutral`, `info`, `success`, `warning`,
  `error`, `ghost`, `link`, or `default` for the plain uncoloured `btn` surface.
- `size` — `xs`, `sm`, `md` (default), `lg`
- `shape` — `square`, `circle`, `wide`, `block`
- `outline` — boolean; stacks on top of `variant`, so `variant="error" outline` is an outlined
  destructive button. It is not a variant of its own.
- `href` — renders an `<a>` instead of a `<button>`
- `title` — tooltip text, merged onto the button itself rather than a wrapper (nesting a button
  inside the tooltip trigger drops the control out of the accessibility tree — pinned by
  `Button.svelte.spec.ts`)
- `class` — escape hatch. A daisyUI colour passed here still wins over the `primary` default, so an
  escape hatch can never collide with it, but reach for `variant` instead.

`Action`, `SubmitButton` and every `shared/actions/*Action.svelte` wrapper take the same
`variant`/`size`/`shape`/`outline` props and forward them here.

## SubmitButton

Status-aware submit button that reads from `FormContext`. Shows spinner while pending, checkmark on success, X on error.

```svelte
<SubmitButton
	label="Save"
	successLabel="Saved"
	errorLabel="Error"
	variant="primary"
	disabled={!isValid}
	shortcut="mod+s"
/>
```

Place inside a `<Form>`. `variant` sets the idle colour; the success/error flash overrides it while
it lasts, so a destructive `variant="error"` submit still reads as success once it lands.

For standalone async actions outside a form — and for anything needing a confirmation step or a
form modal — use `Action`.

## Action

A single component that handles four patterns depending on its props: direct async action, confirmation dialog, callback modal, or form modal. Detects the mode from the `action` prop and presence of `body`/`confirm`.

### Direct action

Runs an async callback on click. Same behavior as `AsyncButton`.

```svelte
<Action action={() => archive(item.id)} label="Archive" successToast="Archived" size="sm" />
```

### With confirmation

When `confirm` is set (and no `body`), an alert dialog is shown before firing the callback:

```svelte
<Action
	action={() => deleteItem(item.id)}
	label="Delete"
	variant="error"
	size="sm"
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

When `action` is a `RemoteForm` (from a `form()` remote), clicking the button opens a modal with a `<Form>` wrapper. Provide the fields via the **`form`** snippet. The modal includes a built-in `SubmitButton` and closes on success.

> **Use `form`, not `body`, whenever `action` is a RemoteForm.** `Action` checks
> `{#if body}` _before_ the RemoteForm branch, so a `body` snippet renders your
> fields bare — no `<Form>` wrapper, no submit button, nothing posts. `body` is
> for the callback-modal mode only.

```svelte
<Action action={updateItem} label="Edit" size="sm" modalTitle="Edit Item" successToast="Updated">
	{#snippet form()}
		<FormField name="name" type="text" value={item.name} />
		<FormField name="description" type="textarea" value={item.description} />
	{/snippet}
</Action>
```

For `.for()` instances (per-row actions in a list). The row id has to travel with the submission, so include it as a hidden input matching the schema's field name:

```svelte
{#each items as item (item.id)}
	<Action action={updateItem.for(item.id)} label="Edit" modalTitle="Edit {item.name}" ...>
		{#snippet form()}
			<input type="hidden" name="id" value={item.id} />
			<FormField name="name" type="text" value={item.name} />
		{/snippet}
	</Action>
{/each}
```

### Mode detection

| `action` type | `body`  | `form`  | `confirm` | Mode                                |
| ------------- | ------- | ------- | --------- | ----------------------------------- |
| callback      | —       | —       | —         | Direct action                       |
| callback      | —       | —       | string    | Confirmation dialog                 |
| callback      | snippet | —       | —         | Callback modal                      |
| RemoteForm    | —       | snippet | —         | Form modal                          |
| RemoteForm    | snippet | —       | —         | ⚠️ broken — fields render unwrapped |

### Props

- `action` — async callback `() => Promise<any>` or a `RemoteForm` from `form()`
- `label` — button text (also used as default submit label in modals)
- `icon` — optional icon snippet on the trigger button
- `confirm` — string message for the confirmation dialog (callback mode, no body)
- `modalTitle` — title for the modal (callback modal and form modal modes)
- `body` — snippet rendered inside the modal, as-is. **Callback-modal mode only** — it takes precedence over the RemoteForm branch, so passing it alongside a RemoteForm action silently breaks the form.
- `form` — snippet rendered inside the `<Form>` wrapper in form-modal mode. Receives `{ close }`.
- `submitLabel` — override the submit button label in the modal (defaults to `label`)
- `submitVariant` — colour of the modal's submit button (defaults to the trigger's `variant`)
- `canSubmit` — boolean that gates the submit button in callback modal mode (default `true`). Ignored in form-modal mode where Zod handles validation.
- `maxWidth` — modal width class (default `'max-w-lg'`)
- `successToast` / `errorToast` — toast messages
- `onsuccess` / `onfailure` — callbacks
- `variant` / `size` / `shape` / `outline` — forwarded to `Button`; `variant` defaults to `primary`
- `class` — escape hatch, forwarded to `Button`
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
	tabs={[
		{ key: 'upcoming', label: 'Upcoming' },
		{ key: 'past', label: 'Past' }
	]}
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

## Card

The panel surface. `Card` + `CardBody` + `CardTitle`, from
`$lib/components/shared/Card/`. Most sections want `InfoCard` (below) instead — reach for these
directly only when the section has no title, or when the body needs a non-default layout.

```svelte
<Card>
	<CardBody>
		<CardTitle>Schedule</CardTitle>
		…
	</CardBody>
</Card>

<Card bordered>
	<!-- border instead of shadow, for a nested card -->
	<CardBody row>…</CardBody>
	<!-- label left, control right -->
</Card>
```

- `Card` — `tone` (`base-100` default, `base-200`, `base-300`), `bordered`. The shadow is not
  optional and not configurable: `shadow` and `shadow-sm` were both in circulation, and this is
  where that got settled.
- `CardBody` — `padding` (`md` default, `sm`), `row` (label/control row instead of a column),
  `center`.
- `CardTitle` — `size` (`sm`, `base`, `lg`; omit for daisyUI's own), `level` (`2`/`3`/`4`, default
  `3`). **`level` is the page outline, `size` is how loud it looks** — pick `level` from where the
  card sits under `PageHeader`'s `<h1>`, never from how big you want the text.

Not everything with a `card` class should become one: a clickable card is an `<a>`, a list card is
an `<li>`, and tinted one-offs (`bg-warning/10 border-warning/40`) stay hand-written.

## InfoCard

Titled card — the default section on a detail page. Thin composition over `Card`/`CardBody`/`CardTitle`.

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

## DefinitionList / Fact

The label/value grid on staff detail pages. Replaces the hand-written
`<dl class="grid gap-x-4 gap-y-2 text-sm" style="grid-template-columns: auto 1fr;">`
that was copy-pasted into nine files.

```svelte
import DefinitionList from '$lib/components/shared/DefinitionList/DefinitionList.svelte'; import
Fact from '$lib/components/shared/DefinitionList/Fact.svelte';

<DefinitionList>
	<Fact label="Status"><StatusBadge status={item.status} /></Fact>
	<Fact label="ID" mono>{item.id}</Fact>
	<Fact label="Category" value={item.category.name} />
	{#if item.notes}
		<Fact label="Notes" wrap>{item.notes}</Fact>
	{/if}
</DefinitionList>
```

`Fact` props:

- `label` — the `<dt>` text.
- `value` — plain-text `<dd>`. Ignored when children are supplied.
- `mono` — `font-mono text-xs`, for IDs and provider record keys.
- `wrap` — `whitespace-pre-wrap`, for free-text notes.
- `class` — extra classes on the `<dd>`.

**`Fact` renders a bare `<dt>` + `<dd>` with no wrapper, and it must stay that
way.** The two columns are a CSS grid declared on the `<dl>`, which only aligns
when the `<dt>`s and `<dd>`s are direct children of it. Wrapping them in a
`<div>` collapses every detail page's label gutter, and nothing throws —
`DefinitionList.svelte.spec.ts` asserts the structure for exactly that reason.

Use a `class` prop rather than a `class:` directive for conditional styling:
`class:` directives do not forward from a component to its inner element.

Not every `<dl>` belongs here — `member/equipment/loans` puts icons and tooltips
in its `<dt>`s, which `Fact`'s string `label` deliberately doesn't support.

## DayTimeline

Horizontal bar showing a day's reservations from 9am–10pm. Highlights one "current" slot in primary and shows others in secondary.

```svelte
<DayTimeline
	current={{ id: 'abc', startsAt: '...', endsAt: '...', bookerType: 'user' }}
	others={[
		{
			id: 'def',
			startsAt: '...',
			endsAt: '...',
			bookerType: 'event',
			label: 'Band Practice',
			href: '/staff/reservations/def'
		}
	]}
/>
```

The `others` array is optional. Each slot's `href` makes it clickable; `label` shows on hover.

## EmptyState

Consistent empty-state message for lists and tables. Prefer it over a bare
`<p class="opacity-60">`, and give it a next action wherever one exists.

```svelte
{#if items.length === 0}
	<EmptyState
		title="No reservations yet"
		description="Book a room to get started."
		actionLabel="Book a session"
		actionHref="/member/reservations"
	/>
{/if}
```

Props:

- `title` — bold line above the message
- `description` — the message (preferred; `message` is an older alias for the same slot)
- `actionLabel` + `actionHref` — renders a link. **Both are required**; passing
  only one renders nothing. Skip them when the only sensible action is a button
  already visible on the page.
- `children` — when provided, replaces the entire default body (title, message,
  and action are all ignored)
- `class` — useful inside a grid, e.g. `class="col-span-full"`

## Lists and tables

Three small presentational components. **None of them owns columns or fetches
data** — that coupling is what took down the old `DataTable` when the app moved
from `+page.ts` loaders to `query()`, and it is not coming back. Pages write
their own `<th>`/`<td>`, because every staff table has bespoke cells.

### DataList

The async envelope: pending state, empty state, pagination. Pass it the promise
a paginated `query()` returned.

```svelte
<DataList {result} empty="No users found" onpage={(p) => (page = p)}>
	{#snippet children(users)}
		<Table>...</Table>
	{/snippet}
</DataList>
```

- `result` — `Promise<{ rows, pagination }>`. Never fetched here.
- `empty` / `emptyTitle` / `actionLabel` + `actionHref` — passed to `EmptyState`.
- `onpage` — omit for un-paginated lists and no `Pagination` renders.

Give it a card list instead of a `Table` when the row's primary content is
unbounded prose (`/staff/flags`) or the row has three or more always-visible
actions. `/staff/closures` and the event check-in list are the card precedents.

### Table

Chrome only: the `overflow-x-auto` wrapper, the daisyUI modifiers, and
`thead`/`tbody`.

```svelte
<Table>
	{#snippet head()}
		<th class="w-px"><span class="sr-only">Status</span></th>
		<th>Member</th>
		<th class="col-support cell-num">Amount</th>
	{/snippet}
	{#each rows as row (row.id)}
		<tr class="hover cursor-pointer" use:rowLink={resolve(`/staff/users/${row.id}`)}> ... </tr>
	{/each}
</Table>
```

- `size` — `'xs' | 'sm' | 'md'`, default `'sm'`. Leave it alone; `sm` is the
  density the panel is designed around.
- `zebra` — default on. Turn it **off** on tables with `bg-base-200` group-header
  rows (reservations, events), where striping muddies the grouping.

### FilterBar

Toolbar layout, not filter state — pages keep their own `$state`. Search stays
visible at every width; everything else collapses behind a "Filters" disclosure
below the `@lg` container breakpoint.

```svelte
<FilterBar activeCount={activeFilterCount} onclear={clearFilters}>
	{#snippet search()}
		<SearchInput
			bind:value={searchText}
			placeholder="Search members..."
			onsearch={(q) => {
				searchQuery = q;
				page = 1;
			}}
		/>
	{/snippet}
	<Select size="sm" aria-label="Role" bind:value={roleFilter}>…</Select>
</FilterBar>
```

`SearchInput` (`$lib/components/shared/Form/`) owns the 300ms debounce, so a page keeps only the
value it queries on. `bind:value` is the immediate text, for Clear; setting it from outside also
cancels any search still in flight.

Name the page's search state `searchText`, not `search` — the `search` snippet
shadows a same-named script binding.

**Do not write `input-bordered`, `select-bordered`, `textarea-bordered` or `file-input-bordered`.** They are daisyUI 4
spellings that emit no CSS in daisyUI 5, where the border is the default.

### Column slots

Every list row is built from the same four slots, in this order:

0. **Status glyph** — optional, `w-px`, one icon-only `StatusBadge`. Never hidden.
1. **Primary cell** — `cell-primary`, two lines. Strong line is what the list is
   _of_ (or its ordering key); subline is its single closest qualifier. The only
   cell allowed to carry two facts. Never hidden.
2. **Middle columns** — one fact each, one visibility tier each.
3. **Actions** — `w-px`, right-aligned, icon-only via `<Action iconOnly>` so the
   label moves to a tooltip. Three or more actions collapse to a
   `dropdown dropdown-end`. Never hidden.

**Merge before you hide.** If a column repeats or merely qualifies the primary
cell, delete it and make it the subline — don't tier it. `MemberLink` already
renders the email and the admin/staff/sustaining glyph, so a list showing a
member never needs separate Email or role columns.

**Column budget:** 6 at ≥896px, 4 at ≥512px, 3 at 327px. Wanting a 7th means the
fact belongs on the detail page.

### Visibility tiers

Defined in `src/routes/layout.css` as container queries. `PageContent` is an
`@container`, so they track the content column, not the viewport, and keep
working when the sidebar opens at `lg`. Apply the same class to a column's `<th>`
and every one of its `<td>`s.

| Class         | Appears at | For                                                   |
| ------------- | ---------- | ----------------------------------------------------- |
| _(none)_      | always     | status, primary cell, actions — plus at most one more |
| `col-support` | ≥512px     | money, counts, secondary dates                        |
| `col-extra`   | ≥768px     | resource IDs, provider record IDs, created-at         |

`cell-primary` (`width: 100%; max-width: 0`) is what makes `truncate` work
inside a cell: under `table-layout: auto` a column sizes to its content, so
without it long text widens the table until the last column is clipped. Exactly
one cell per row gets it.

`cell-num` right-aligns, applies tabular figures, and prevents wrapping. Use it
on every currency, count, quantity, and balance column.

### Dates

Date cells always get `whitespace-nowrap`, and lists use the short formatters —
the weekday is noise in a date-sorted list and it is what makes cells wrap.

- `formatDateShort` — "May 13", when the year is obvious from context
- `formatDateShortYear` — "May 13, 2026", for durable facts like a join date
- `formatDateTimeShort` — "May 13, 2:30 PM"
- `relativeDay` — "2 days ago", best for recency columns (last message, updated)

Keep `formatDate` / `formatDateTime` for detail pages and group headers, where
the weekday earns its space.

### Row navigation

```svelte
<tr class="hover cursor-pointer" use:rowLink={resolve(`/staff/users/${row.id}`)}>
```

`rowLink` (`$lib/actions/row-link`) navigates with `goto`, ignores clicks that
land on an interactive element, respects modifier-clicks, and doesn't hijack a
click that ended a text selection — so cells no longer need their own
`onclick={(e) => e.stopPropagation()}`.

Rows are deliberately **not** focusable: a focusable `<tr>` announces the whole
row as one button. The accessible path is the real `<a>` in the primary cell,
which every clickable row must have.

### Sorting

There isn't any, on purpose. No `query()` accepts a sort parameter, and a
`Table` that knows about sorting is the first step back toward the component
this replaced. If a page genuinely needs it, add `sort`/`dir` to _that page's_
filter schema and give it its own header control.

## StatCard

Single stat display for dashboards.

```svelte
<StatCard title="Total Users" value={stats.userCount} />
<StatCard title="Members" value={band.memberCount} size="sm" />
<StatCard title="Your Role" value={role} size="sm" valueClass="capitalize" />
```

Props: `title`, `value`, `size` (`'sm'` renders the value at `text-2xl`, `'md'`
keeps daisyUI's default), `class` (outer card), `valueClass` (value line).

Use `size="sm"` rather than hand-rolling the raw `stat` markup — the default
value size overflows a narrow panel column once three sit in a row, and that is
exactly why two pages rebuilt the card by hand before the prop existed.

## ShareButton

Copies the current page URL and flashes a checkmark.

```svelte
<ShareButton title="Copy link to this event" />
```

Props: `title` (tooltip — name the thing being shared), `class` (defaults to
`btn btn-ghost btn-sm btn-square`).

The clipboard write can reject on permissions or a non-secure context; the
failure is deliberately silent, because a convenience affordance failing loudly
is worse than the checkmark not appearing.

## Pagination

Page navigation for lists. Spread the `pagination` object a paginated `query()`
returns; `onpage` receives the requested page number.

```svelte
<Pagination {...pagination} onpage={(p) => (page = p)} />
```

Page buttons are windowed with ellipses, so a 40-page list renders a handful of
buttons rather than 40. The `Showing X–Y of Z` line renders even for a single
page, so every list states its size. `DataList` renders this for you — reach for
`Pagination` directly only outside a `DataList`.

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

## Public site sections

The marketing pages (`(public)/`) compose from `$lib/components/shared/marketing/`:

```svelte
<Hero title="Programs">Practice spaces, performances, meetups & clubs for the music community</Hero>

<Section tint="success" class="program-block">…</Section>
<Section tint="primary">
	<SectionHeading title="Two Ways to Belong">Everyone starts with a free account.</SectionHeading>
	…
</Section>
```

- `Section` — `tint` (`none`, `primary`, `secondary`, `success`, `warning`, `info`), `pad`
  (`sm`/`md`/`lg`), `width` (the inner measure: `2xl`, `3xl`, `5xl`, `full`), `center`, `sunburst`.
  Alternating the brand tints down a page is what gives the marketing site its rhythm.
- `Hero` — the page masthead. Takes `title`; children are the subtitle line.
- `SectionHeading` — centred title block, with an optional `eyebrow` snippet (usually a
  `sticker-badge`) and a lede as children.

Brand ink is `text-cmc-navy` / `text-cmc-teal` / `text-cmc-orange` — never an inline
`style="color: var(--cmc-navy)"`.

## Create forms live in modals

"Create" flows (new reservation, new event, etc.) should open in a modal on the list page, not navigate to a separate `/new` route. This keeps the user in context and avoids a full page transition for what's usually a short form. The modal is a sibling component to the list page (e.g. `CreateModal.svelte`) and is toggled by a button in the `PageHeader`.

Edit/detail views remain full pages at `[id]/`.

## CSS conventions

- Buttons are `<Button variant size>` — never a raw `<button class="btn …">` or a `class="btn-ghost btn-sm"` string. The same goes for `Action`, `SubmitButton` and the `*Action` wrappers.
- Supporting text is `text-muted` (the `text-sm` tier) or `text-subtle` (the `text-xs` tier), not `text-sm opacity-60`. `text-fg-2` / `text-fg-3` / `surface` reach the tokens directly when the size is already set.
- Otherwise use bare daisyUI component classes. Extra Tailwind overrides are fine for spacing on parents but avoid overriding component internals.
- Cards: `card bg-base-100 shadow` (use `shadow` not `shadow-sm`).
- Form inputs: `input input-bordered` (standard size). Use `input-sm` only on dense settings-style forms, and be consistent within a page.
- Page content width: constrain with `max-w-md` (forms), `max-w-2xl` (settings), or let it fill (tables/dashboards).
- Spacing between sections: `space-y-6` on the page content wrapper.

## Component locations

All shared components live in `src/lib/components/`. Panel-specific layout components are in subdirectories (`staff/`, `member/`). Feature-specific components that are only used on one page live alongside that page or in a feature subdirectory under `member/`.

## Directory profiles

Member and band profiles — public (`/directory/...`) and authenticated (`/member/directory/...`) — are all built from **one parameterised component set** in `src/lib/components/shared/directory/profile/`. Member vs. band and public vs. authenticated are prop differences, never separate designs. The four `+page.svelte` files are thin assemblers: `await` the profile query (+ a shows query), map data to props, compose.

Components:

- `ProfileHeader` — avatar + name + subtitle + status pills + a single email-backed primary action + a copy-link share button. Pills are exception-only (omitted when absent).
- `QuickFacts` — a 4-up key/value strip; empty facts are dropped.
- `ProseBlock` — bio/about markdown via `sanitizeBio`; hidden when empty.
- `ListenStrip` — service tabs + one switchable in-page embed (Spotify/YouTube/etc.).
- `ShowsBox` — Upcoming/Past toggle with a past-show count, rendering both tabs with the public gig guide's `GigList` rows. Past shows page in 20 at a time behind a "Show more" button. Bands show their own events (byline suppressed — every row is that band); members show shows aggregated across their active bands. Pass `eventBase`/`bandBase` to point row links at the member routes.
- `CrossRefList` — the relational spine: a member's Bands ↔ a band's Members. Private members render as locked, unlinked rows in the public view so the count stays honest.
- `TagCloud` — instrument/genre chips (`sticker-badge`).
- `LinksBox` — streaming services as an icon ribbon, web/social as labelled rows. Distinct from `ListenStrip` (play here vs. go elsewhere).
- `ContactBox` — Contact (member) / Booking (band); all CTAs resolve to `mailto:`.
- `ProfileSection` (titled box), `ProfileGrid` (main/side two-column layout), `EntityAvatar` (shared avatar) are the layout primitives.

**Avatar shape convention:** a member avatar is always **round**, a band avatar always **square** — use `EntityAvatar shape="round|square"` (or `Avatar` for members) anywhere one represents these entities.

Pure display logic (link partitioning, embeddable-service ordering, the private-row rule) lives in `src/lib/utils/directory-display.ts` and is unit-tested — keep DB/Svelte concerns out of it.

## Inbox

`/member/messages` and `/staff/inbox` are the same two-pane interface: a conversation list beside the open conversation. Both mount `InboxShell` from a `+layout.svelte`, so the list survives navigating between threads and every `/…/[id]` URL keeps working — `/staff/inbox/[id]` is deep-linked from notification emails, the in-app bell and the staff user record.

Components in `src/lib/components/inbox/`:

- `InboxShell` — the two-pane frame. One pane at a time below `lg`, both from `lg`; which one shows on a phone follows whether a thread is open. Each pane scrolls its own overflow, so a conversation and a list of conversations never share a scrollbar. Every link in that flex chain needs `min-h-0`.
- `ThreadHeader` — title, subtitle, trailing actions, and an optional disclosure below. Its back button is `lg:hidden` and is the only way out of a conversation on a phone.
- `ThreadTimeline` — messages (and staff-only notes) on one chronological spine. Orients on `viewerUserId`, not direction; see `member-portal-chat-spec.md`.
- `ThreadComposer` — the reply box. `noteForm` is **optional**: omit it and the Reply/Internal note tabs disappear, which is the member side, since notes are staff-private.
- `channels.ts` — `channelLabel` / `channelIcon`, the single source of truth for how a channel is named and drawn. Use it rather than a local ternary on `channel`.

**A list pane that mirrors filter state into the URL must write onto the current pathname**, not a hard-coded index path. It lives in the layout, so it keeps running while a thread is open — pinned to the index it navigates straight back out of whatever was just opened.
