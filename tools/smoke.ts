// Browser smoke test against dist/ at phone size: the younger son's year 830 played from the boyhood
// scenes to the spring of 831, then every tab and a reload. Screenshots go to smoke-out/. Fails on console errors or a step that cannot be found.
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
/** Headings worth a screenshot the first time they show (the year 830, start to spring). */
const SHOTS: [RegExp, string][] = [
  [/The ship that came home/, 'boyhood'], [/^The Raven$/, 'muster'], [/^At sea$/, 'at-sea'], [/The hall at Birsay/, 'birsay'],
  [/^Iona$/, 'iona'], [/^The landing$/, 'iona-landing'], [/^The lough$/, 'bangor'], [/The shield-wall/, 'battle'], [/^Plunder:/, 'plunder'],
  [/^The field$|^The strand$/, 'after-battle'], [/^Home$/, 'home'], [/The winter hall/, 'hall'], [/^Yule$/, 'yule'], [/^Heiðr$/, 'volva'],
  [/^Thorgils$/, 'flyting'], [/^The name$/, 'the-name'], [/^Spring, 831$/, 'spring-card'], [/The ice goes out/, 'spring-831'],
];
/** Buttons to prefer, in order; otherwise the first enabled choice. Plunder leaves after two rounds. */
const PREFER = [/^Continue/, 'Let the men handle it', 'Let instinct take it', /^Sail on$/, /^Row (out|on|home) with/, /Haul up/, /Take your share/, /Train with the men/, /Practise with your bench-mates/];

try {
  await page.goto(`http://localhost:${port}/`);
  await snap('title');
  await click(page, 'Begin a new life');
  await snap('new-game');
  await click(page, /^Begin$/);
  const seen = new Set<string>();
  let rounds = 0;
  let last = '';
  for (let step = 0; step < 1400; step++) {
    const h = ((await page.locator('main h2').first().textContent({ timeout: 2000 }).catch(() => '')) ?? '').trim();
    last = h;
    for (const [re, name] of SHOTS) if (re.test(h) && !seen.has(name)) { seen.add(name); await snap(name); }
    if (seen.has('spring-831') || (await page.locator('button', { hasText: 'Begin another life' }).count())) break;
    if (h.startsWith('Plunder:')) {
      await click(page, ++rounds > 2 ? /Back to the ships|Head for the ships/ : /Strip the next house/);
      continue;
    }
    let clicked = false;
    for (const t of PREFER) {
      const b = page.locator('main button:not([disabled])', { hasText: t }).first();
      if (await b.count()) { await b.click(); clicked = true; break; }
    }
    if (!clicked) {
      // the safe road where there is one, so the run is the same every time; a fight where there isn't
      const safe = page.locator('main .choices button:not([disabled]):not(.danger)').first();
      await ((await safe.count()) ? safe : page.locator('main .choices button:not([disabled])').first()).click({ timeout: 4000 });
    }
  }
  for (const need of ['boyhood', 'muster', 'birsay', 'bangor', 'home', 'yule']) if (!seen.has(need) && !(await page.locator('button', { hasText: 'Begin another life' }).count())) errors.push(`never reached: ${need} (last screen: "${last}")`);
  for (const t of ['Map', 'Hero', 'Crew', 'Saga']) {
    await page.locator('.tabs button', { hasText: t }).click();
    await snap(`tab-${t.toLowerCase()}`);
  }
  await page.locator('.tabs button', { hasText: 'Now' }).click();
  await page.locator('button[aria-label="Menu"]').click();
  await snap('menu');
  // a reload keeps the life
  await page.reload();
  await click(page, 'Continue your life');
  await snap('reloaded');
  // 831: the Conaille chapter, as captain, through the king's doorway to leaving the bay
  await page.locator('button[aria-label="Menu"]').click();
  await page.locator('button', { hasText: 'Back to the title' }).click();
  await click(page, 'Play from a chapter');
  await click(page, /^Conaille, 831/);
  await snap('conaille');
  await click(page, /^Continue/);
  await click(page, /Straight up from the beach/);
  const seen831 = new Set<string>();
  for (let step = 0; step < 200; step++) {
    const h = ((await page.locator('main h2').first().textContent({ timeout: 2000 }).catch(() => '')) ?? '').trim();
    for (const [re, name] of [[/The shield-wall/, 'conaille-battle'], [/doorway|Máel Brigte/, 'conaille-king'], [/^Leaving Conaille|Plain of Muirthemne/i, 'conaille-after']] as [RegExp, string][]) if (re.test(h) && !seen831.has(name)) { seen831.add(name); await snap(name); }
    if (seen831.has('conaille-after') || (await page.locator('button', { hasText: /Begin another life|Back to the chapters/ }).count())) break;
    if (h.startsWith('Plunder:')) { await click(page, /Back to the ships|Head for the ships/); continue; }
    let clicked = false;
    for (const t of PREFER) {
      const b = page.locator('main button:not([disabled])', { hasText: t }).first();
      if (await b.count()) { await b.click(); clicked = true; break; }
    }
    if (!clicked) {
      // the safe road where there is one, so the run is the same every time; a fight where there isn't
      const safe = page.locator('main .choices button:not([disabled]):not(.danger)').first();
      await ((await safe.count()) ? safe : page.locator('main .choices button:not([disabled])').first()).click({ timeout: 4000 });
    }
  }
  if (!seen831.has('conaille-after') && !(await page.locator('button', { hasText: /Back to the chapters/ }).count())) errors.push('the Conaille chapter never reached the end of the raid');
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
