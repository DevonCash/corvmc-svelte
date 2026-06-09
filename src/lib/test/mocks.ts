// Mock helpers for isolated component tests.
//
// Coupled components either (a) await a remote `query`/`command` or (b) receive a
// remote `form()` object. For (a), mock the whole `.remote` module with `vi.mock`
// inside the spec (the factory must inline its return value — vi.mock is hoisted
// above imports, so it can't reference these helpers). For (b), pass the fakes
// below directly as props — no module mock needed.

/**
 * Minimal stand-in for a SvelteKit `RemoteFormField`. The real object's
 * `.as(type, value)` returns the input attributes; a checkbox field's name is
 * `b:`-prefixed so the submitted value coerces to a boolean. Mirrors the inline
 * helper proven in `FormField.svelte.spec.ts`.
 */
export function fakeField(name: string) {
	return {
		as: (type: string, value?: unknown) => ({
			name: type === 'checkbox' ? `b:${name}` : name,
			type,
			value: value ?? '',
			'aria-invalid': undefined
		}),
		issues: () => null
	} as never;
}

/**
 * Minimal stand-in for a remote `form()` object as consumed by the `actions/*`
 * components: it exposes `.fields` and is otherwise an inert no-op so the form
 * renders and submits nothing.
 */
export function fakeForm(fieldNames: string[] = []) {
	const fields = Object.fromEntries(fieldNames.map((n) => [n, fakeField(n)]));
	return {
		fields,
		method: 'POST',
		action: '',
		enhance: () => ({ destroy: () => {} }),
		result: undefined,
		pending: 0
	} as never;
}
