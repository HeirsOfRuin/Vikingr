// Browser smoke test against dist/ at phone size: new game, muster, a voyage, a fight if one comes,
// every tab. Screenshots go to smoke-out/. Fails on console errors or a step that cannot be found.
// Usage: npm run build && npm run smoke
import { chromium, type Page } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const DIST = join(import.meta.dirname, '..', 'dist');
const OUT = join(import.meta.dirname, '..', 'smoke-out');
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('smoke: build first (npm run build)');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });
const server = createServer((req, res) => {
  const p = join(DIST, decodeURIComponent((req.url ?? '/').split('?')[0]!).replace(/\/$/, '/index.html'));
  if (!p.startsWith(DIST) || !existsSync(p)) { res.statusCode = 404; res.end(); return; }
  res.setHeader('content-type', TYPES[extname(p)] ?? 'application/octet-stream');
  res.end(readFileSync(p));
}).listen(0);
const port = (server.address() as { port: number }).port;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors: string[] = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));

let shot = 0;
const snap = async (name: string) => page.screenshot({ path: join(OUT, `${String(++shot).padStart(2, '0')}-${name}.png`), fullPage: false });
const click = async (p: Page, text: string | RegExp) => {
  const b = p.locator('button:not([disabled])', { hasText: text }).first();
  await b.waitFor({ timeout: 4000 });
  await b.click();
};
/** Clicks through reports, scenes and fights until one of the wanted buttons shows. */
const until = async (wanted: RegExp, max = 60) => {
  for (let i = 0; i < max; i++) {
    if (await page.locator('button:not([disabled])', { hasText: wanted }).count()) return;
    for (const t of [/^Continue$/, 'Let the men handle it', 'Let instinct take it', 'Sail on', /^Begin\.$/, /Drink, listen/, /Laugh it off/, /Leave the dead/, /Turn and fight/]) {
      const b = page.locator('button:not([disabled])', { hasText: t }).first();
      if (await b.count()) { await b.click(); break; }
    }
  }
  throw new Error(`never reached ${wanted}`);
};

try {
  await page.goto(`http://localhost:${port}/`);
  await snap('title');
  await click(page, 'Begin a new life');
  await snap('new-game');
  await click(page, /^Begin$/);
  await snap('start-scene');
  await until(/Put to sea/);
  await snap('muster');
  await click(page, /Sign on/);
  await until(/Put to sea/);
  await click(page, 'Buy provisions').catch(() => undefined);
  await until(/Put to sea/);
  await click(page, /Put to sea/);
  await until(/Sail to Hjaltland/);
  await snap('home-place');
  await click(page, /Sail to Hjaltland/);
  await snap('at-sea');
  await until(/Sail to Orkneyjar/);
  await snap('shetland');
  await click(page, /Sail to Orkneyjar/);
  await until(/Sail to Iona|Sail to Hjaltland/);
  await snap('orkney');
  if (await page.locator('button:not([disabled])', { hasText: /Sail to Iona/ }).count()) {
    await click(page, /Sail to Iona/);
    await until(/Raid Iona|Sail to Orkneyjar/);
    await snap('iona');
    if (await page.locator('button:not([disabled])', { hasText: /Raid Iona/ }).count()) {
      await click(page, /Raid Iona/);
      await snap('battle');
      await click(page, /Hold the wall|Push|Throw spears/);
      await snap('battle-round');
      await until(/Sail to Orkneyjar|Sail to Bangor|Begin another life/);
      await snap('after-raid');
    }
  }
  for (const t of ['Map', 'Hero', 'Crew', 'Saga']) {
    await page.locator('.tabs button', { hasText: t }).click();
    await snap(`tab-${t.toLowerCase()}`);
  }
  await page.locator('.tabs button', { hasText: 'Now' }).click();
  await page.locator('button', { hasText: 'Menu' }).click();
  await snap('menu');
  // a reload keeps the life
  await page.reload();
  await click(page, 'Continue your life');
  await snap('reloaded');
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  if (width > 390) errors.push(`page is ${width}px wide at a 390px viewport (horizontal scroll)`);
} catch (e) {
  errors.push((e as Error).message);
  await snap('failure');
}
await browser.close();
server.close();
if (errors.length) {
  console.log(`smoke: FAILED\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(`smoke: ok, ${shot} screenshots in smoke-out/`);
