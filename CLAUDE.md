## New Feature Checklist

When building a new feature, follow these phases in order:

1. **Design** — Understand the domain and map workflows before proposing any models. Produce a spec in `docs/specs/` if the feature touches multiple files or introduces new schema.
2. **Schema** — Add columns/tables via drizzle schema files. Do not write migrations — the user will generate them with `drizzle-kit`. Add shared types to `src/lib/types/` if the feature introduces new structures (JSONB shapes, enums, etc.).
3. **Services** — Build server-side logic in `src/lib/server/<domain>/`. Keep query functions and mutation functions separated. Validate inputs in the service layer with explicit limits (max lengths, max items).
4. **Routes & UI** — Build pages using the patterns in `docs/development/ui-patterns.md`. Add `data.remote.ts` files for form/query handling. Add nav links in the relevant layout (`member`, `band`, `staff`).
5. **Seed data** — Update `scripts/seed-dev.ts` so the feature has realistic data for local development. Use `@anatine/zod-mock` to generate fake data from Zod schemas. Use pools of sample values and randomized assignment for domain-specific fields.
6. **Tests** — Write tests that describe intended behavior, not current implementation. Use service-level mocks where direct DB access isn't practical. Failing tests are fine if they reflect unfinished business logic.
7. **Verify** — Run `svelte-check` and confirm no new type errors in the files you touched. Pre-existing errors in unrelated files can be ignored.
8. **Document** — Update `docs/reports/parity-report.md` with the new feature row. If a design spec was produced, it should already be in `docs/specs/`.
9. **Commit** — Use a descriptive commit message summarizing what the feature adds. No co-author lines.

## UI Patterns

Before building or modifying any page, read `docs/development/ui-patterns.md`. It defines the shared components (Form, FormField, SubmitButton, PageHeader, StatusBadge, etc.) and composition patterns that all pages must follow. Use it whenever creating new routes, adding forms, or touching page layout.

Every form in a route file must use the `Form`, `FormField`, and `SubmitButton` components from `$lib/components/shared/Form/`. Never use raw `<form>`, `<input>`, or `<select>` elements directly in page files — even for small inline forms. Mutations should use `form()` from `$app/server` in `data.remote.ts` so the `<Form>` component can wire up validation and dirty tracking automatically.

## Project Configuration

- **Language**: TypeScript
- **Package Manager**: pnpm
- **Add-ons**: vitest, playwright, tailwindcss, drizzle, sveltekit-adapter, mcp, mdsvex, better-auth, storybook, prettier, eslint

---

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.

## Bits UI

> Bits UI is a headless component library for Svelte.

This site provides documentation in a format optimized for Large Language Models, with each page available as a clean markdown file.

### Complete Documentation

- [Complete documentation](https://bits-ui.com/docs/llms.txt): The complete Bits UI documentation including all general content, components, type helpers, and utilities

### General

- [Child Snippet Documentation](https://bits-ui.com/docs/child-snippet/llms.txt): Detailed documentation for Child Snippet
- [Components Documentation](https://bits-ui.com/docs/components/llms.txt): Detailed documentation for Components
- [Dates Documentation](https://bits-ui.com/docs/dates/llms.txt): Detailed documentation for Dates
- [Getting Started Documentation](https://bits-ui.com/docs/getting-started/llms.txt): Detailed documentation for Getting Started
- [Introduction Documentation](https://bits-ui.com/docs/introduction/llms.txt): Detailed documentation for Introduction
- [Llms Documentation](https://bits-ui.com/docs/llms/llms.txt): Detailed documentation for Llms
- [Migration Guide Documentation](https://bits-ui.com/docs/migration-guide/llms.txt): Detailed documentation for Migration Guide
- [Ref Documentation](https://bits-ui.com/docs/ref/llms.txt): Detailed documentation for Ref
- [State Management Documentation](https://bits-ui.com/docs/state-management/llms.txt): Detailed documentation for State Management
- [Styling Documentation](https://bits-ui.com/docs/styling/llms.txt): Detailed documentation for Styling
- [Transitions Documentation](https://bits-ui.com/docs/transitions/llms.txt): Detailed documentation for Transitions

### Components

- [Accordion Documentation](https://bits-ui.com/docs/components/accordion/llms.txt): Detailed documentation for Accordion
- [Alert Dialog Documentation](https://bits-ui.com/docs/components/alert-dialog/llms.txt): Detailed documentation for Alert Dialog
- [Aspect Ratio Documentation](https://bits-ui.com/docs/components/aspect-ratio/llms.txt): Detailed documentation for Aspect Ratio
- [Avatar Documentation](https://bits-ui.com/docs/components/avatar/llms.txt): Detailed documentation for Avatar
- [Button Documentation](https://bits-ui.com/docs/components/button/llms.txt): Detailed documentation for Button
- [Calendar Documentation](https://bits-ui.com/docs/components/calendar/llms.txt): Detailed documentation for Calendar
- [Checkbox Documentation](https://bits-ui.com/docs/components/checkbox/llms.txt): Detailed documentation for Checkbox
- [Collapsible Documentation](https://bits-ui.com/docs/components/collapsible/llms.txt): Detailed documentation for Collapsible
- [Combobox Documentation](https://bits-ui.com/docs/components/combobox/llms.txt): Detailed documentation for Combobox
- [Command Documentation](https://bits-ui.com/docs/components/command/llms.txt): Detailed documentation for Command
- [Context Menu Documentation](https://bits-ui.com/docs/components/context-menu/llms.txt): Detailed documentation for Context Menu
- [Date Field Documentation](https://bits-ui.com/docs/components/date-field/llms.txt): Detailed documentation for Date Field
- [Date Picker Documentation](https://bits-ui.com/docs/components/date-picker/llms.txt): Detailed documentation for Date Picker
- [Date Range Field Documentation](https://bits-ui.com/docs/components/date-range-field/llms.txt): Detailed documentation for Date Range Field
- [Date Range Picker Documentation](https://bits-ui.com/docs/components/date-range-picker/llms.txt): Detailed documentation for Date Range Picker
- [Dialog Documentation](https://bits-ui.com/docs/components/dialog/llms.txt): Detailed documentation for Dialog
- [Dropdown Menu Documentation](https://bits-ui.com/docs/components/dropdown-menu/llms.txt): Detailed documentation for Dropdown Menu
- [Label Documentation](https://bits-ui.com/docs/components/label/llms.txt): Detailed documentation for Label
- [Link Preview Documentation](https://bits-ui.com/docs/components/link-preview/llms.txt): Detailed documentation for Link Preview
- [Menubar Documentation](https://bits-ui.com/docs/components/menubar/llms.txt): Detailed documentation for Menubar
- [Meter Documentation](https://bits-ui.com/docs/components/meter/llms.txt): Detailed documentation for Meter
- [Navigation Menu Documentation](https://bits-ui.com/docs/components/navigation-menu/llms.txt): Detailed documentation for Navigation Menu
- [Pagination Documentation](https://bits-ui.com/docs/components/pagination/llms.txt): Detailed documentation for Pagination
- [Pin Input Documentation](https://bits-ui.com/docs/components/pin-input/llms.txt): Detailed documentation for Pin Input
- [Popover Documentation](https://bits-ui.com/docs/components/popover/llms.txt): Detailed documentation for Popover
- [Progress Documentation](https://bits-ui.com/docs/components/progress/llms.txt): Detailed documentation for Progress
- [Radio Group Documentation](https://bits-ui.com/docs/components/radio-group/llms.txt): Detailed documentation for Radio Group
- [Range Calendar Documentation](https://bits-ui.com/docs/components/range-calendar/llms.txt): Detailed documentation for Range Calendar
- [Rating Group Documentation](https://bits-ui.com/docs/components/rating-group/llms.txt): Detailed documentation for Rating Group
- [Scroll Area Documentation](https://bits-ui.com/docs/components/scroll-area/llms.txt): Detailed documentation for Scroll Area
- [Select Documentation](https://bits-ui.com/docs/components/select/llms.txt): Detailed documentation for Select
- [Separator Documentation](https://bits-ui.com/docs/components/separator/llms.txt): Detailed documentation for Separator
- [Slider Documentation](https://bits-ui.com/docs/components/slider/llms.txt): Detailed documentation for Slider
- [Switch Documentation](https://bits-ui.com/docs/components/switch/llms.txt): Detailed documentation for Switch
- [Tabs Documentation](https://bits-ui.com/docs/components/tabs/llms.txt): Detailed documentation for Tabs
- [Time Field Documentation](https://bits-ui.com/docs/components/time-field/llms.txt): Detailed documentation for Time Field
- [Time Range Field Documentation](https://bits-ui.com/docs/components/time-range-field/llms.txt): Detailed documentation for Time Range Field
- [Toggle Group Documentation](https://bits-ui.com/docs/components/toggle-group/llms.txt): Detailed documentation for Toggle Group
- [Toggle Documentation](https://bits-ui.com/docs/components/toggle/llms.txt): Detailed documentation for Toggle
- [Toolbar Documentation](https://bits-ui.com/docs/components/toolbar/llms.txt): Detailed documentation for Toolbar
- [Tooltip Documentation](https://bits-ui.com/docs/components/tooltip/llms.txt): Detailed documentation for Tooltip

### Utilities

- [Bits Config Documentation](https://bits-ui.com/docs/utilities/bits-config/llms.txt): Detailed documentation for Bits Config
- [Is Using Keyboard Documentation](https://bits-ui.com/docs/utilities/is-using-keyboard/llms.txt): Detailed documentation for Is Using Keyboard
- [Merge Props Documentation](https://bits-ui.com/docs/utilities/merge-props/llms.txt): Detailed documentation for Merge Props
- [Portal Documentation](https://bits-ui.com/docs/utilities/portal/llms.txt): Detailed documentation for Portal
- [Use Id Documentation](https://bits-ui.com/docs/utilities/use-id/llms.txt): Detailed documentation for Use Id

### Type Helpers

- [With Element Ref Documentation](https://bits-ui.com/docs/type-helpers/with-element-ref/llms.txt): Detailed documentation for With Element Ref
- [Without Child Documentation](https://bits-ui.com/docs/type-helpers/without-child/llms.txt): Detailed documentation for Without Child
- [Without Children Or Child Documentation](https://bits-ui.com/docs/type-helpers/without-children-or-child/llms.txt): Detailed documentation for Without Children Or Child
- [Without Children Documentation](https://bits-ui.com/docs/type-helpers/without-children/llms.txt): Detailed documentation for Without Children
