// The phone sweep (docs/FRAME-GAUNTLET.md, check 6): every kind of screen the gauntlet's lives reached, loaded
// into the real build at 390 px, and every tab of one life, checked for what a phone player would hit:
// the page wider than the phone, buttons too small to tap, text cut off, errors in the console.
// Usage: npm run build && npm run gauntlet && npm run gauntlet:phone. Writes gauntlet-out/phone.json and phone/*.jpg.
import { chromium, type Page } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'gauntlet-out');
const SHOTS = join(OUT, 'phone');
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
if (!existsSync(join(DIST, 'index.html'))) { console.error('phone: build first (npm run build)'); process.exit(1); }
const files = existsSync(join(OUT, 'screens')) ? readdirSync(join(OUT, 'screens')).filter((f) => f.endsWith('.json')).sort() : [];
if (!files.length) { console.error('phone: run the gauntlet first (npm run gauntlet)'); process.exit(1); }
rmSync(SHOTS, { recursive: true, force: true });
mkdirSync(SHOTS, { recursive: true });

const server = createServer((req, res) => {
  const p = join(DIST, decodeURIComponent((req.url ?? '/').split('?')[0]!).replace(/\/$/, '/index.html'));
  if (!p.startsWith(DIST) || !existsSync(p)) { res.statusCode = 404; res.end(); return; }
  res.setHeader('content-type', TYPES[extname(p)] ?? 'application/octet-stream');
  res.end(readFileSync(p));
}).listen(0);
const port = (server.address() as { port: number }).port;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
let errors: string[] = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));

interface Seen { screen: string; tab: string; shot: string; problems: string[] }
const results: Seen[] = [];

/** What a phone player would hit on the screen as it stands. */
// passed as a string: the TypeScript runner would otherwise wrap named functions in a helper the page doesn't have
const INSPECT = `(() => {
  const out = [];
  const W = window.innerWidth;
  const name = (e) => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + (e.textContent ? ' "' + e.textContent.trim().slice(0, 30) + '"' : '');
  if (document.documentElement.scrollWidth > W + 1) {
    const wide = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > W + 1 && getComputedStyle(e).position !== 'fixed'; }).slice(0, 3);
    out.push('wider than the phone (' + document.documentElement.scrollWidth + 'px): ' + wide.map(name).join('; '));
  }
  const small = [...document.querySelectorAll('button, a[href], input, select')].filter((e) => {
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !e.disabled && (r.height < 36 || r.width < 36);
  });
  if (small.length) out.push(small.length + ' tap target(s) under 36px: ' + small.slice(0, 3).map((e) => { const r = e.getBoundingClientRect(); return name(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); }).join('; '));
  const clipped = [...document.querySelectorAll('button, h1, h2, h3, p, td, dd, .pill, .hint')].filter((e) => {
    const cs = getComputedStyle(e);
    return (cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.textOverflow === 'ellipsis') && e.scrollWidth > e.clientWidth + 2;
  });
  if (clipped.length) out.push(clipped.length + ' element(s) with text cut off: ' + clipped.slice(0, 3).map(name).join('; '));
  return out;
})()`;

async function inspect(p: Page): Promise<string[]> {
  return p.evaluate(INSPECT) as Promise<string[]>;
}

let n = 0;
async function shot(label: string): Promise<string> {
  const f = `${String(++n).padStart(3, '0')}-${label.replace(/[^a-z0-9-]+/gi, '-')}.jpg`;
  await page.screenshot({ path: join(SHOTS, f), type: 'jpeg', quality: 55 });
  return f;
}

try {
  let tabsDone = false;
  for (const f of files) {
    const screen = f.replace(/\.json$/, '');
    const save = readFileSync(join(OUT, 'screens', f), 'utf8');
    await page.goto(`http://localhost:${port}/`);
    await page.evaluate((s) => localStorage.setItem('vikingr.save.1', s), save);
    await page.reload();
    errors = [];
    await page.getByRole('button', { name: /Continue your life/ }).click({ timeout: 5000 });
    await page.waitForTimeout(250);
    const problems = [...(await inspect(page)), ...errors.map((e) => `console: ${e.slice(0, 120)}`)];
    results.push({ screen, tab: 'now', shot: await shot(screen), problems });
    // every tab once, from a life at the beach (the screen with the most around it)
    if (!tabsDone && screen.startsWith('place-sailing')) {
      tabsDone = true;
      for (const tab of ['Map', 'Hero', 'Crew', 'Home', 'Saga']) {
        errors = [];
        await page.locator('nav.tabs button', { hasText: tab }).first().click();
        await page.waitForTimeout(250);
        const pr = [...(await inspect(page)), ...errors.map((e) => `console: ${e.slice(0, 120)}`)];
        results.push({ screen, tab: tab.toLowerCase(), shot: await shot(`${screen}-${tab}`), problems: pr });
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
writeFileSync(join(OUT, 'phone.json'), JSON.stringify(results, null, 1));
const bad = results.filter((r) => r.problems.length);
console.log(`phone: ${results.length} screens at 390px, ${bad.length} with problems`);
for (const r of bad.slice(0, 12)) console.log(`  ${r.screen} (${r.tab}): ${r.problems.join(' | ')}`);
