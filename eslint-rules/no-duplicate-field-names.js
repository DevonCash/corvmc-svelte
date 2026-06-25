/**
 * Resolve the submitted property name from an element's attributes, or null when it
 * can't be determined statically.
 *
 * Two static-analyzable forms (see src/lib/components/shared/Form/FormField.svelte):
 *   name="bio"          -> "bio"
 *   field={fields.bio}  -> "bio"  (FormField derives its name from the field)
 *
 * @param {any} node a SvelteElement
 * @returns {{ name: string, attr: any } | null}
 */
function resolveFieldName(node) {
	const attributes = node.startTag?.attributes ?? [];

	for (const attr of attributes) {
		if (attr.type !== 'SvelteAttribute') continue;

		// name="bio" — single literal value.
		if (attr.key?.name === 'name') {
			if (
				attr.value?.length === 1 &&
				attr.value[0].type === 'SvelteLiteral' &&
				typeof attr.value[0].value === 'string'
			) {
				return { name: attr.value[0].value, attr };
			}
			// Dynamic name={expr} — not statically resolvable.
			return null;
		}

		// field={fields.bio} or field={fields['bio']} — derive the property name.
		if (attr.key?.name === 'field') {
			if (attr.value?.length === 1 && attr.value[0].type === 'SvelteMustacheTag') {
				const expr = attr.value[0].expression;
				if (expr?.type === 'MemberExpression') {
					if (!expr.computed && expr.property?.type === 'Identifier') {
						return { name: expr.property.name, attr };
					}
					if (
						expr.computed &&
						expr.property?.type === 'Literal' &&
						typeof expr.property.value === 'string'
					) {
						return { name: expr.property.value, attr };
					}
				}
			}
			return null;
		}
	}

	return null;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow two form fields submitting the same property name within one form.'
		},
		messages: {
			duplicateName:
				'Duplicate form field name "{{name}}" in this <Form>. Each field must submit a unique property name.'
		}
	},
	create(context) {
		/** @type {Array<{ names: Map<string, any> }>} */
		const formStack = [];

		function isFormTag(node) {
			const tag = node.name?.name;
			return tag === 'Form' || tag === 'form';
		}

		return {
			SvelteElement(node) {
				if (isFormTag(node)) {
					formStack.push({ names: new Map() });
					return;
				}

				const scope = formStack[formStack.length - 1];
				if (!scope) return;

				const resolved = resolveFieldName(node);
				if (!resolved) return;

				if (scope.names.has(resolved.name)) {
					context.report({
						node: resolved.attr,
						messageId: 'duplicateName',
						data: { name: resolved.name }
					});
				} else {
					scope.names.set(resolved.name, resolved.attr);
				}
			},
			'SvelteElement:exit'(node) {
				if (isFormTag(node)) formStack.pop();
			}
		};
	}
};
