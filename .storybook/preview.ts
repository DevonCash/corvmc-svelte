import type { Preview } from '@storybook/sveltekit';
// Load the app's real global stylesheet so daisyUI themes, brand `--cmc-*`
// tokens, and the @plugin/utility layers apply inside Storybook. Without this,
// components render unstyled.
import '../src/routes/layout.css';

// Toolbar control to flip between the two daisyUI themes defined in layout.css.
export const globalTypes = {
	theme: {
		description: 'daisyUI theme',
		defaultValue: 'corvmc',
		toolbar: {
			title: 'Theme',
			icon: 'paintbrush',
			items: [
				{ value: 'corvmc', title: 'Light' },
				{ value: 'corvmc-dark', title: 'Dark' }
			],
			dynamicTitle: true
		}
	}
};

const preview: Preview = {
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i
			}
		},

		a11y: {
			// 'todo' - show a11y violations in the test UI only
			// 'error' - fail CI on a11y violations
			// 'off' - skip a11y checks entirely
			test: 'todo'
		}
	},
	decorators: [
		// Apply the selected theme to the document and paint the canvas with the
		// theme's base surface so dark mode is actually visible.
		(story, context) => {
			const theme = (context.globals.theme as string) ?? 'corvmc';
			if (typeof document !== 'undefined') {
				document.documentElement.setAttribute('data-theme', theme);
				document.body.style.background = 'var(--color-base-100)';
				document.body.style.color = 'var(--color-base-content)';
			}
			return story();
		}
	]
};

export default preview;
