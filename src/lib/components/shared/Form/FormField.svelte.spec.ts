import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FormField from './FormField.svelte';

// Minimal stand-in for a SvelteKit RemoteFormField. The real object's `.as(type, value)`
// returns the input attributes (name/value/type/aria-invalid); the second argument is
// what controls the rendered value for edit forms.
function fakeField(name: string) {
	return {
		as: (type: string, value?: unknown) => ({
			name,
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
});
