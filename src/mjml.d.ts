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
