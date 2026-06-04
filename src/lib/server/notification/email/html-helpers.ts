// ---------------------------------------------------------------------------
// HTML email element helpers
// ---------------------------------------------------------------------------
// These produce the same output as MJML's <mj-text>, <mj-button>, and
// <mj-divider> elements, but without requiring the MJML runtime.
// Styles match the compiled MJML output with our mj-attributes defaults.
// ---------------------------------------------------------------------------

const FONT = "font-family:system-ui, -apple-system, 'Segoe UI', sans-serif";

interface TextOptions {
	fontSize?: string;
	fontWeight?: string;
	color?: string;
	align?: string;
	cssClass?: string;
}

/** Equivalent of <mj-text> */
export function text(content: string, opts: TextOptions = {}): string {
	const fontSize = opts.fontSize ?? '15px';
	const fontWeight = opts.fontWeight ? `font-weight:${opts.fontWeight};` : '';
	const color = opts.color ?? '#374151';
	const align = opts.align ?? 'left';
	const cssClass = opts.cssClass ? ` class="${opts.cssClass}"` : '';

	return `<tr>
	<td align="${align}"${cssClass} style="font-size:0px;padding:10px 25px;word-break:break-word;">
		<div style="${FONT};font-size:${fontSize};${fontWeight}line-height:1.6;text-align:${align};color:${color};">${content}</div>
	</td>
</tr>`;
}

/** Equivalent of <mj-button> */
export function button(label: string, href: string): string {
	return `<tr>
	<td align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;">
		<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:separate;line-height:100%;">
			<tbody><tr>
				<td align="center" bgcolor="#6366f1" role="presentation" style="border:none;border-radius:6px;cursor:auto;mso-padding-alt:10px 25px;background:#6366f1;" valign="middle">
					<a href="${href}" rel="noopener noreferrer" style="display:inline-block;background:#6366f1;color:#ffffff;${FONT};font-size:15px;font-weight:600;line-height:120%;letter-spacing:normal;margin:0;text-decoration:none;text-transform:none;padding:10px 25px;mso-padding-alt:0px;border-radius:6px;" target="_blank">${label}</a>
				</td>
			</tr></tbody>
		</table>
	</td>
</tr>`;
}

/** Equivalent of <mj-divider> */
export function divider(borderColor = '#e5e7eb', borderWidth = '1px'): string {
	return `<tr>
	<td style="font-size:0px;padding:10px 25px;word-break:break-word;">
		<p style="border-top:solid ${borderWidth} ${borderColor};font-size:1px;margin:0px auto;width:100%;"></p>
	</td>
</tr>`;
}
