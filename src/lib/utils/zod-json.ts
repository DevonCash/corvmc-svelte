import { z } from 'zod';

/**
 * A form field carrying a JSON-encoded array (hidden inputs written by
 * TagInput and the multi-select fields).
 *
 * `.transform((s) => JSON.parse(s))` looks equivalent but throws on malformed
 * input, and a throw inside a transform escapes validation as a 500 rather than
 * surfacing as a field issue. Remote functions are directly callable endpoints,
 * so malformed input is reachable. This reports a normal validation issue
 * instead.
 */
export function jsonArrayField<T extends z.ZodTypeAny>(element: T, message = 'Invalid selection') {
	return z
		.string()
		.transform((s, ctx) => {
			try {
				const parsed: unknown = JSON.parse(s);
				if (!Array.isArray(parsed)) {
					ctx.addIssue({ code: 'custom', message });
					return z.NEVER;
				}
				return parsed;
			} catch {
				ctx.addIssue({ code: 'custom', message });
				return z.NEVER;
			}
		})
		.pipe(z.array(element));
}
