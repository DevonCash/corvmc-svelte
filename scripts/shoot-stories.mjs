// Throwaway: screenshot every Storybook story in light + dark for the visual audit.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = 'http://localhost:6006';
const OUT = '/tmp/story-shots';
const THEMES = ['corvmc', 'corvmc-dark'];

const index = await fetch(`${BASE}/index.json`).then((r) => r.json());
const stories = Object.values(index.entries).filter((e) => e.type === 'story');

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 2 });

const manifest = [];
for (const s of stories) {
	for (const theme of THEMES) {
		const url = `${BASE}/iframe.html?id=${s.id}&viewMode=story&globals=theme:${theme}`;
		await page.goto(url, { waitUntil: 'networkidle' });
		await page.waitForTimeout(400); // let fonts/art settle
		const file = `${OUT}/${s.id}__${theme}.png`;
		await page.screenshot({ path: file });
		manifest.push({ id: s.id, title: s.title, name: s.name, theme, file });
	}
}

await writeFile(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2));
await browser.close();
console.log(`Captured ${manifest.length} screenshots for ${stories.length} stories -> ${OUT}`);
