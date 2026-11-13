// The itch.io store images (store/): the cover, five phone screenshots from the real build, and the embed-size check.
// Usage: npx tsx tools/make-press.ts            (runs `npm run build` first, then serves dist/ itself)
//        npx tsx tools/make-press.ts --no-build (uses dist/ as it stands)
//        --only=cover,shots,embed,counts       (any subset; default all)
//        --seed=N                              (the mid-game life; default below)
// The screenshots are played, not mocked: one life is run by the reference bot (tools/bot-lib.ts) with a fixed
// seed, states are taken from it as it goes, and each is loaded into the built page through its own save key
// (src/ui/storage.ts) and opened with Continue, as a player would.
import { chromium, type Browser, type Page } from 'playwright';
import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { loadContent } from './content-loader';
import { Bot, BOT_OPTS } from './bot-lib';
import { act, listActions, newGame } from '../src/engine/index';
import { RngCursor, seedRng } from '../src/engine/rng';
import { dateOf } from '../src/engine/calendar';
import { livingFame } from '../src/engine/fame';
import { toSave } from '../src/engine/save';
import { ERAS } from '../src/engine/era';
import type { GameState } from '../src/engine/state';

const ROOT = join(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'store');
const SAVE_KEY = 'vikingr.save.1';
const args = process.argv.slice(2);
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const only = new Set((opt('only') ?? 'counts,cover,shots,embed').split(','));
const SEED = Number(opt('seed') ?? 9110);
mkdirSync(OUT, { recursive: true });

// ---- 1. the build ----
if (!args.includes('--no-build') && (only.has('shots') || only.has('embed'))) {
  try {
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
  } catch {
    if (!existsSync(join(DIST, 'index.html'))) { console.error('press: the build failed and there is no dist/'); process.exit(1); }
    console.warn('press: the build failed; using the dist/ already there');
  }
}
if ((only.has('shots') || only.has('embed')) && !existsSync(join(DIST, 'index.html'))) { console.error('press: no dist/ (run without --no-build)'); process.exit(1); }

const content = loadContent();

// ---- 2. the counts for store/ITCH.md, read from content/ through the loader ----
if (only.has('counts')) {
  const scenes = Object.values(content.scenes);
  const words = scenes.reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0);
  const counts = {
    scenes: scenes.length,
    scenesPlaceholder: scenes.filter((s) => s.placeholder).length,
    sceneWords: words,
    choices: scenes.reduce((n, s) => n + s.choices.length, 0),
    places: Object.keys(content.places).length,
    // 830 is the default start (newGame without an era); the later starts are src/engine/era.ts ERAS
    eras: [830, ...Object.keys(ERAS).map(Number)].sort(),
    backgrounds: Object.keys(content.backgrounds).length,
    upbringings: Object.keys(content.upbringing).length,
    rivals: Object.keys(content.rivals).length,
    lords: Object.keys(content.lords).length,
    ships: Object.keys(content.ships).length,
    art: Object.keys(content.art).length,
  };
  writeFileSync(join(OUT, 'counts.json'), JSON.stringify(counts, null, 1) + '\n');
  console.log('press: counts', JSON.stringify(counts));
}

// ---- 3. a life, and the states the screenshots need ----
interface Taken { scene: GameState[]; battle: GameState[]; plunder: GameState[]; mid: GameState | null }
function playLife(): Taken {
  BOT_OPTS.settle = true;
  BOT_OPTS.ambitious = true;
  const taken: Taken = { scene: [], battle: [], plunder: [], mid: null };
  let s = newGame(content, { background: 'younger_son', seed: SEED, name: 'Hrafn' });
  const bot = new Bot('raider', new RngCursor(seedRng(SEED ^ 0x5bd1e995)));
  const start = dateOf(s.day).year;
  const lastPage = (text: string) => text.split(/^\s*\[break\]\s*$/m).map((t) => t.trim()).filter(Boolean).pop() ?? '';
  let steps = 0;
  while (!s.death && dateOf(s.day).year < start + 30 && steps < 150000) {
    const a = bot.choose(s, content);
    if (!a) break;
    try { s = act(content, s, a); } catch { break; }
    steps++;
    const y = dateOf(s.day).year;
    const p = s.pending;
    // (a) a story scene: a picture, three or more choices, a last page short enough to leave the choices on screen
    if (p?.t === 'scene' && taken.scene.length < 12) {
      const sc = content.scenes[p.id]!;
      const key = typeof sc.art === 'string' ? sc.art : sc.art?.key;
      const choices = listActions(s, content).filter((o) => o.enabled);
      if (key && content.art[key] && !sc.placeholder && choices.length >= 3 && lastPage(sc.text).length < 520 && !taken.scene.some((x) => (x.pending as { id: string }).id === p.id)) taken.scene.push(structuredClone(s));
    }
    // (c) a shield-wall part-way through: a few rounds in, both lines still standing
    if (p?.t === 'battle' && !p.battle.over && p.battle.log.length >= 3 && p.battle.us.men >= 15 && p.battle.them.men >= 10 && taken.battle.length < 8 && !taken.battle.some((x) => dateOf(x.day).year === y)) taken.battle.push(structuredClone(s));
    // (d) plunder of a named place with its picture, a few turns into the alarm
    if (p?.t === 'plunder' && p.plunder.log.length >= 3 && content.places[p.plunder.place]?.art && taken.plunder.length < 8 && !taken.plunder.some((x) => (x.pending as { plunder: { place: string } }).plunder.place === p.plunder.place)) taken.plunder.push(structuredClone(s));
    // (b, e) the middle of a life: twelve years on, land abroad with a ship-fort among it, at a beach with nothing pending
    if (!taken.mid && y >= start + 12 && !p && s.at && !s.voyage && s.phase === 'sailing' && (s.holdings ?? []).length >= 3 && (s.holdings ?? []).some((h) => h.kind === 'fort') && s.known.length >= 18) taken.mid = structuredClone(s);
    if (taken.mid && y >= start + 16 && taken.battle.length >= 4 && taken.plunder.length >= 3 && taken.scene.length >= 5) break;
  }
  const d = taken.mid ? dateOf(taken.mid.day) : null;
  console.log(`press: life seed ${SEED}: ${steps} actions to ${dateOf(s.day).year}; scenes ${taken.scene.length}, battles ${taken.battle.length}, plunders ${taken.plunder.length}, mid-life ${d ? `${d.year} (fame ${Math.round(livingFame(taken.mid!))}, ${taken.mid!.holdings!.length} holdings, ${taken.mid!.ships.length} ships)` : 'none'}`);
  return taken;
}

// ---- 4. the server: dist/ as it is, and a page that holds it in an iframe for the embed check ----
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function serve(): Promise<{ port: number; close: () => void }> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/__embed') {
      const w = Number(url.searchParams.get('w')), h = Number(url.searchParams.get('h'));
      res.setHeader('content-type', 'text/html');
      res.end(`<!doctype html><html><body style="margin:0;background:#333;display:grid;place-items:center;min-height:100vh"><iframe id="g" src="/" width="${w}" height="${h}" style="border:0;display:block"></iframe></body></html>`);
      return;
    }
    const p = join(DIST, decodeURIComponent(url.pathname).replace(/\/$/, '/index.html'));
    if (!p.startsWith(DIST) || !existsSync(p)) { res.statusCode = 404; res.end(); return; }
    res.setHeader('content-type', TYPES[extname(p)] ?? 'application/octet-stream');
    res.end(readFileSync(p));
  });
  return new Promise((ok) => server.listen(0, () => ok({ port: (server.address() as { port: number }).port, close: () => server.close() })));
}

// the preinstalled Chromium (as tools/art.ts and the phone sweep find it), else Playwright's own
const launch = (): Promise<Browser> => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());

/** Fonts in, pictures drawn, nothing still moving into place. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
}

/** Dismiss anything a first visit shows over the game (a hint, a how-to-play sheet): this is a returning player. */
async function clearHints(page: Page): Promise<void> {
  for (let i = 0; i < 4; i++) {
    const b = page.locator('.hintbox button, .tip button, .firsthint button, [data-hint] button, .menu .choice.primary:has-text("Close")').first();
    if (!(await b.isVisible().catch(() => false))) return;
    await b.click().catch(() => undefined);
    await page.waitForTimeout(150);
  }
}

/** Load a state into the build as its save, then Continue. */
async function open(page: Page, base: string, state: GameState): Promise<void> {
  await page.goto(base);
  await page.evaluate(([k, v]) => {
    // every first-visit flag the game keeps beside the save, set as seen; then the life itself
    for (const key of Object.keys(localStorage)) if (key !== k) localStorage.removeItem(key);
    localStorage.setItem(k, v);
  }, [SAVE_KEY, JSON.stringify(toSave(state, content))] as const);
  await page.reload();
  await page.getByRole('button', { name: /Continue your life/ }).click({ timeout: 8000 });
  await settle(page);
  await clearHints(page);
}

/** Nothing a player should not see: dev banners, debug dumps, error cards, or the page wider than the phone. */
async function audit(page: Page, label: string): Promise<string[]> {
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    const t = document.body.innerText;
    for (const re of [/Playtest chapter/i, /not saved\./i, /\bseed \d+/, /undefined|NaN|\[object/, /\{[a-z_]+\}/]) if (re.test(t)) out.push(`text matches ${re}`);
    if (document.querySelector('pre')) out.push('a <pre> (debug) block');
    if (document.documentElement.scrollWidth > innerWidth + 1) out.push(`wider than the phone (${document.documentElement.scrollWidth}px)`);
    return out;
  });
  return bad.map((b) => `${label}: ${b}`);
}

async function shoot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: join(OUT, name) });
  console.log(`press: wrote store/${name}`);
}

// ---- 5. the screenshots ----
async function shots(taken: Taken): Promise<string[]> {
  const problems: string[] = [];
  const srv = await serve();
  const base = `http://localhost:${srv.port}/`;
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const tabBar = 844 - 60;
  try {
    // (a) the story: the first candidate whose choices sit above the tab bar once its pages are read
    let best: { s: GameState; fit: number } | null = null;
    for (const s of taken.scene) {
      await open(page, base, s);
      for (let i = 0; i < 8; i++) {
        const more = page.locator('.choices .choice:has(.pagecount)');
        if (!(await more.count())) break;
        await more.first().click();
        await page.waitForTimeout(150);
      }
      const bottoms = await page.locator('main .choices .choice').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().bottom));
      const fit = bottoms.filter((b) => b <= tabBar).length;
      if (bottoms.length >= 3 && fit === bottoms.length) { best = { s, fit: 99 }; break; }
      if (!best || fit > best.fit) best = { s, fit };
    }
    if (!best) throw new Error('no story scene was taken');
    await open(page, base, best.s);
    for (let i = 0; i < 8; i++) {
      const more = page.locator('.choices .choice:has(.pagecount)');
      if (!(await more.count())) break;
      await more.first().click();
      await page.waitForTimeout(150);
    }
    await page.evaluate(() => scrollTo(0, 0));
    await settle(page);
    problems.push(...(await audit(page, 'story')));
    console.log(`press: story scene ${(best.s.pending as { id: string }).id}${best.fit === 99 ? '' : ' (choices run under the tab bar)'}`);
    await shoot(page, 'shot-1-story.png');

    if (!taken.mid) throw new Error('no mid-life state was taken (try another --seed)');
    // (b) the map: the known world, from a beach in the middle of a life
    await open(page, base, taken.mid);
    await page.locator('nav.tabs button', { hasText: 'Map' }).click();
    await settle(page);
    problems.push(...(await audit(page, 'map')));
    await shoot(page, 'shot-2-map.png');

    // (c) the shield-wall in progress: the latest one taken (the biggest lines)
    const battle = taken.battle[taken.battle.length - 1];
    if (!battle) throw new Error('no battle was taken');
    await open(page, base, battle);
    problems.push(...(await audit(page, 'battle')));
    await shoot(page, 'shot-3-battle.png');

    // (d) plunder: a place with its picture, the alarm rising
    const plunder = taken.plunder[Math.min(1, taken.plunder.length - 1)];
    if (!plunder) throw new Error('no plunder was taken');
    await open(page, base, plunder);
    problems.push(...(await audit(page, 'plunder')));
    await shoot(page, 'shot-4-plunder.png');

    // (e) Lords, land and rule, on the Saga tab, scrolled to the card
    await open(page, base, taken.mid);
    await page.locator('nav.tabs button', { hasText: 'Saga' }).click();
    await settle(page);
    const card = page.locator('.card', { has: page.locator('h3', { hasText: 'Lords, land and rule' }) }).first();
    await card.evaluate((e) => { const top = e.getBoundingClientRect().top + scrollY - 64; scrollTo(0, top); });
    await page.waitForTimeout(300);
    problems.push(...(await audit(page, 'lords')));
    await shoot(page, 'shot-5-lords.png');
  } finally {
    await browser.close();
    srv.close();
  }
  return [...problems, ...[...new Set(errors)].map((e) => `console: ${e.slice(0, 160)}`)];
}

// ---- 6. the cover, from the game's own pixel art, palette and fonts ----
/** The picture and the left edge (in the 400-pixel art) of the 315-pixel window shown. */
const COVER_ART = { key: 'sail_home', x: 40 };
async function cover(): Promise<void> {
  const b64 = (p: string) => readFileSync(join(ROOT, p)).toString('base64');
  const font = (fam: string, file: string, weight: number) => `@font-face{font-family:'${fam}';font-weight:${weight};src:url(data:font/woff2;base64,${b64(`node_modules/@fontsource/${file}`)}) format('woff2')}`;
  const art = (k: string) => `data:image/png;base64,${b64(`src/art/${k}.png`)}`;
  // the converted art is 400 x 160; at exactly 2x (800 x 320, every pixel a 2 x 2 square) a 315-pixel window of it,
  // round the ship, fills the top of the cover, and the wordmark stands on the dark ground below
  const html = `<!doctype html><html><head><style>
${font('Alegreya SC', 'alegreya-sc/files/alegreya-sc-latin-700-normal.woff2', 700)}
${font('Alegreya SC', 'alegreya-sc/files/alegreya-sc-latin-500-normal.woff2', 500)}
${font('Alegreya', 'alegreya/files/alegreya-latin-400-italic.woff2', 400)}
:root{--soot:#111213;--granite-900:#191b1c;--granite-700:#30363a;--bone:#e6ddc8;--bone-dim:#b5ac97;--rune-red:#b3352a;--rune-red-dark:#6b2018;--ochre:#c8913a}
html,body{margin:0;background:var(--soot)}
.c{position:relative;width:630px;height:500px;overflow:hidden;background:var(--soot)}
.pic{position:absolute;left:0;top:0;width:630px;height:320px;background:url(${art(COVER_ART.key)}) no-repeat;background-size:800px 320px;background-position:-${COVER_ART.x * 2}px 0;image-rendering:pixelated}
.pic::after{content:'';position:absolute;inset:0;background:linear-gradient(to bottom,rgba(17,18,19,0) 58%,rgba(17,18,19,.7) 82%,var(--soot) 100%)}
.band{position:absolute;left:0;right:0;bottom:0;height:6px;background:repeating-linear-gradient(90deg,var(--rune-red-dark) 0 9px,var(--soot) 9px 13px)}
h1{position:absolute;left:0;right:0;top:268px;margin:0;text-align:center;font:700 116px/1 'Alegreya SC',serif;letter-spacing:.12em;padding-left:.12em;color:var(--bone);text-shadow:0 3px 0 var(--soot),0 0 22px rgba(17,18,19,.95)}
.sub{position:absolute;left:0;right:0;top:394px;text-align:center;font:500 28px/1.1 'Alegreya SC',serif;letter-spacing:.06em;color:var(--ochre)}
.era{position:absolute;left:0;right:0;top:442px;text-align:center;font:italic 400 23px/1 'Alegreya',serif;color:var(--bone-dim)}
</style></head><body><div class="c"><div class="pic"></div><h1>VIKINGR</h1><div class="sub">From nothing, to sea king, to Valhalla</div><div class="era">The Viking age, 830 to 870</div><div class="band"></div></div></body></html>`;
  writeFileSync(join(OUT, 'cover.html'), html);
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 630, height: 500 }, deviceScaleFactor: 1 });
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(OUT, 'cover.png'), clip: { x: 0, y: 0, width: 630, height: 500 } });
    // the half-size check: itch shows covers at 315 x 250 in its grids, smoothly scaled
    const small = await browser.newPage({ viewport: { width: 315, height: 250 }, deviceScaleFactor: 1 });
    await small.setContent(`<html><body style="margin:0"><img src="data:image/png;base64,${readFileSync(join(OUT, 'cover.png')).toString('base64')}" width="315" height="250" style="display:block"></body></html>`);
    await small.waitForTimeout(100);
    await small.screenshot({ path: join(OUT, 'cover-315.png'), clip: { x: 0, y: 0, width: 315, height: 250 } });
  } finally {
    await browser.close();
  }
  console.log('press: wrote store/cover.png, store/cover-315.png (and store/cover.html, its source)');
}

// ---- 7. the embed size: the title's buttons on screen, without scrolling, inside an itch-style iframe ----
async function embed(mid: GameState | null): Promise<void> {
  const srv = await serve();
  const browser = await launch();
  const lines: string[] = [];
  try {
    for (const [w, h] of [[540, 860], [600, 860], [720, 900], [480, 800]] as const) {
      for (const withSave of [false, true]) {
        const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
        await page.goto(`http://localhost:${srv.port}/`);
        await page.evaluate(([k, v]) => { localStorage.clear(); if (v) localStorage.setItem(k, v); }, [SAVE_KEY, withSave && mid ? JSON.stringify(toSave(mid, content)) : ''] as const);
        await page.goto(`http://localhost:${srv.port}/__embed?w=${w}&h=${h}`);
        const frame = page.frameLocator('#g');
        await frame.locator('.title .choice').first().waitFor({ timeout: 8000 });
        await page.waitForTimeout(500);
        const r = await frame.locator('body').evaluate(() => {
          const btns = [...document.querySelectorAll('.title .choice')].map((b) => ({ t: (b.querySelector('.txt')?.firstChild?.textContent ?? b.textContent ?? '').trim(), bottom: Math.round(b.getBoundingClientRect().bottom) }));
          return { inner: innerHeight, scroll: document.documentElement.scrollHeight, btns };
        });
        const hidden = r.btns.filter((b) => b.bottom > r.inner);
        lines.push(`${w}x${h} ${withSave ? 'with a save' : 'first visit'}: page ${r.scroll}px tall; ${r.btns.length} title buttons, ${hidden.length ? `below the fold: ${hidden.map((b) => `${b.t} (${b.bottom})`).join(', ')}` : `all visible (last ends at ${Math.max(...r.btns.map((b) => b.bottom))})`}`);
        await page.close();
      }
    }
  } finally {
    await browser.close();
    srv.close();
  }
  writeFileSync(join(OUT, 'embed-check.txt'), lines.join('\n') + '\n');
  for (const l of lines) console.log(`press: embed ${l}`);
}

// ---- run ----
let mid: GameState | null = null;
const problems: string[] = [];
if (only.has('cover')) await cover();
if (only.has('shots') || only.has('embed')) {
  const taken = playLife();
  mid = taken.mid;
  if (only.has('shots')) problems.push(...(await shots(taken)));
}
if (only.has('embed')) await embed(mid);
if (problems.length) { console.log(`press: ${problems.length} problem(s):`); for (const p of problems) console.log(`  ${p}`); process.exitCode = 1; }
else if (only.has('shots')) console.log('press: no dev text, debug output or console errors in the screenshots');
