/** @type {import('eslint').Rule.RuleModule} */
export default {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow db.transaction() which is broken on Cloudflare D1. Use db.batch() instead.'
		},
		messages: {
			noTransaction:
				'db.transaction() is not supported on D1. Use db.batch([...queries]) for atomic writes.'
		}
	},
	create(context) {
		return {
			CallExpression(node) {
				if (
					node.callee.type === 'MemberExpression' &&
					node.callee.property.type === 'Identifier' &&
					node.callee.property.name === 'transaction'
				) {
					context.report({ node, messageId: 'noTransaction' });
				}
			}
		};
	}
};
