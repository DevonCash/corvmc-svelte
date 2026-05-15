import type { User, Session } from 'better-auth/minimal';

declare module 'mjml' {
	function mjml2html(
		mjml: string,
		options?: {
			validationLevel?: 'strict' | 'soft' | 'skip';
			minify?: boolean;
			[key: string]: unknown;
		}
	): { html: string; errors: Array<{ message: string; [key: string]: unknown }> };
	export default mjml2html;
}

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			user?: User;
			session?: Session;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
