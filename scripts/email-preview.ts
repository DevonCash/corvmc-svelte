/**
 * Render every email fixture to .email-preview/ for visual checking.
 *
 * Run: pnpm email:preview   then open .email-preview/index.html
 *
 * This uses Handlebars locally (see render-preview.ts). For the authoritative
 * check against Postmark's real Mustachio engine, use `pnpm email:validate`.
 *
 * NOTE: the logo is referenced by its absolute production URL, so it only
 * appears once static/email/cmc-speaker.png has been deployed.
 */
import { mkdirSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { renderTemplate } from '../src/lib/server/notification/email/render-preview';
import { FIXTURES } from '../src/lib/server/notification/email/fixtures';
import { EMAIL_LOGO_URL } from '../src/lib/email/brand';

const OUTDIR = '.email-preview';

rmSync(OUTDIR, { recursive: true, force: true });
mkdirSync(OUTDIR, { recursive: true });

// The templates hardcode the production logo URL (Postmark templates are static
// files with no env access). Point it at a local copy so the header is visible
// before the asset has been deployed.
copyFileSync('static/email/cmc-speaker.png', `${OUTDIR}/cmc-speaker.png`);

/** Escape for a `<pre>` — text-only emails are shown as-is, not interpreted. */
function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Text-only templates have no HTML part at all. Show the text in a `<pre>` so
 * the iframe isn't blank, and make it obvious that is *all* the email contains.
 */
function textOnlyPage(text: string): string {
	return `<!doctype html><meta charset="utf-8">
<body style="margin:0;padding:24px;background:#fff;">
<p style="margin:0 0 16px;font:12px/1.4 system-ui,sans-serif;color:#5f6368;">No HTML part — this email is sent as text/plain only.</p>
<pre style="margin:0;font:14px/1.6 ui-monospace,Menlo,monospace;color:#202124;white-space:pre-wrap;">${escapeHtml(text)}</pre>
</body>`;
}

const rendered = FIXTURES.map((f) => {
	const { html, text, subject } = renderTemplate(f.alias, f.model);
	const plaintext = html === '';
	writeFileSync(
		`${OUTDIR}/${f.name}.html`,
		plaintext ? textOnlyPage(text) : html.replaceAll(EMAIL_LOGO_URL, 'cmc-speaker.png')
	);
	writeFileSync(`${OUTDIR}/${f.name}.txt`, text);
	return { ...f, subject, plaintext };
});

const cards = rendered
	.map(
		(f) => `
    <section class="card">
      <header>
        <h2>${f.name}</h2>
        <p class="alias">${f.alias}${f.plaintext ? ' · <strong>text-only</strong>' : ''}${f.subject ? ` · <em>${f.subject}</em>` : ''}</p>
        <p class="links">${f.plaintext ? '' : `<a href="${f.name}.html" target="_blank">Open HTML</a> · `}<a href="${f.name}.txt" target="_blank">Plain text</a></p>
      </header>
      <iframe src="${f.name}.html" title="${f.name}"></iframe>
    </section>`
	)
	.join('\n');

writeFileSync(
	`${OUTDIR}/index.html`,
	`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CorvMC email preview</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; padding:24px; background:#e8eaed; font:14px/1.5 system-ui, sans-serif; color:#202124; }
  h1 { font-size:20px; margin:0 0 4px; }
  .hint { margin:0 0 24px; color:#5f6368; }
  .grid { display:flex; flex-wrap:wrap; gap:24px; align-items:flex-start; }
  .card { background:#fff; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,.2); overflow:hidden; width:632px; max-width:100%; }
  header { padding:12px 16px; border-bottom:1px solid #dadce0; }
  h2 { font-size:14px; margin:0; font-family:ui-monospace,Menlo,monospace; }
  .alias, .links { margin:2px 0 0; font-size:12px; color:#5f6368; }
  iframe { display:block; width:100%; height:900px; border:0; background:#fff; }
  @media (prefers-color-scheme: dark) {
    body { background:#202124; color:#e8eaed; }
    .card { background:#292a2d; } header { border-color:#3c4043; }
    .hint, .alias, .links { color:#9aa0a6; }
  }
</style>
</head>
<body>
  <h1>CorvMC email preview</h1>
  <p class="hint">${rendered.length} fixtures, rendered at 600px. Toggle your OS light/dark setting to exercise the <code>prefers-color-scheme</code> block; narrow the window to exercise the mobile media query.</p>
  <div class="grid">${cards}
  </div>
</body>
</html>
`
);

console.log(`Rendered ${rendered.length} fixtures to ${OUTDIR}/ — open ${OUTDIR}/index.html`);
