import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FormField from './FormField.svelte';

// Minimal stand-in for a SvelteKit RemoteFormField. The real object's `.as(type, value)`
// returns the input attributes (name/value/type/aria-invalid); the second argument is
// what controls the rendered value for edit forms.
function fakeField(name: string) {
	return {
		// Mirror SvelteKit's `get_type_prefix`: a checkbox field's name is `b:`-prefixed
		// so the submitted value is coerced to a boolean.
		as: (type: string, value?: unknown) => ({
			name: type === 'checkbox' ? `b:${name}` : name,
			type,
			value: value ?? '',
			'aria-invalid': undefined
		}),
		issues: () => null
	} as never;
}

describe('FormField', () => {
	it('pre-fills a field-based text input from the value prop', async () => {
		// Regression: when both `field` and `value` were provided, the value prop was
		// dropped and the input rendered empty (band name not auto-filled).
		render(FormField, {
			field: fakeField('name'),
			type: 'text',
			label: 'Band Name',
			value: 'The Velvet Underground'
		});

		await expect.element(page.getByRole('textbox')).toHaveValue('The Velvet Underground');
	});

	it('renders an empty field-based input when no value is supplied', async () => {
		render(FormField, {
			field: fakeField('tagline'),
			type: 'text',
			label: 'Tagline'
		});

		await expect.element(page.getByRole('textbox')).toHaveValue('');
	});

	// Regression: a checkbox/toggle must submit a real boolean, which SvelteKit only
	// does when the input name carries the `b:` prefix. A string-typed schema otherwise
	// rejects the coerced boolean with "Invalid option: expected one of \"\"|\"on\"".
	it('b:-prefixes a name-only checkbox so the value is a boolean', async () => {
		const { container } = render(FormField, {
			name: 'coverFees',
			type: 'checkbox',
			label: '',
			checkboxLabel: 'Cover fees'
		});
		const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
		expect(input.name).toBe('b:coverFees');
	});

	it('b:-prefixes a name-only toggle so the value is a boolean', async () => {
		const { container } = render(FormField, {
			name: 'published',
			type: 'toggle',
			label: '',
			checkboxLabel: 'Published'
		});
		const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
		expect(input.name).toBe('b:published');
	});

	it('b:-prefixes a field-based checkbox so the value is a boolean', async () => {
		const { container } = render(FormField, {
			field: fakeField('coverFees'),
			type: 'checkbox',
			label: '',
			checkboxLabel: 'Cover fees'
		});
		const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
		expect(input.name).toBe('b:coverFees');
	});

	it('b:-prefixes a field-based toggle so the value is a boolean', async () => {
		const { container } = render(FormField, {
			field: fakeField('lookingForBand'),
			type: 'toggle',
			label: '',
			checkboxLabel: 'Looking for a band'
		});
		const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
		expect(input.name).toBe('b:lookingForBand');
	});
});
