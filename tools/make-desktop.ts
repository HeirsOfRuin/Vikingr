// The full game as a download (npm run build:desktop): one self-contained HTML file that plays offline from disk,
// in any desktop browser, with its fonts and pictures inside it, zipped with a short readme and the fonts' licences.
// Built from the single-file build (VITE_ARTIFACT=1) with VITE_RELEASE=1, so no playtest jumps and no debug dump.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist-artifact-build');
const version = (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string }).version;
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const js = [...html.matchAll(/<script[^>]*src="\.?\/?([^"]+)"[^>]*><\/script>/g)].map((m) => readFileSync(join(dist, m[1]!), 'utf8'));
const css = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="\.?\/?([^"]+)"[^>]*>/g)].map((m) => readFileSync(join(dist, m[1]!), 'utf8'));
if (!js.length) throw new Error('make-desktop: no script; run npm run build:desktop');
const all = js.join('\n');
if (/\.\/assets\//.test(all + css.join(''))) throw new Error('make-desktop: an asset was not inlined');
for (const s of ['Play from a chapter', 'Playtest chapter: not saved', 'The demo ends here']) if (all.includes(s)) throw new Error(`make-desktop: the bundle has "${s}": build with VITE_RELEASE=1 and without VITE_DEMO`);

const safe = (s: string) => s.replace(/<\/script/gi, '<\\/script');
const page = [
  '<!doctype html>',
  '<html lang="en">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  '<meta name="color-scheme" content="dark">',
  '<meta name="theme-color" content="#191b1c">',
  `<title>Vikingr</title>`,
  `<style>html,body{background:#191b1c;margin:0}${css.join('\n')}</style>`,
  '</head>',
  '<body>',
  '<div id="app"></div>',
  `<script type="module">${safe(all)}</script>`,
  '</body>',
  '</html>',
  '',
].join('\n');

const out = join(root, 'release');
const stage = join(out, `vikingr-${version}-desktop`);
rmSync(stage, { recursive: true, force: true });
mkdirSync(join(stage, 'LICENSES'), { recursive: true });
writeFileSync(join(stage, 'Vikingr.html'), page);
writeFileSync(join(stage, 'READ ME.txt'), [
  `Vikingr ${version}`,
  '',
  'To play: open Vikingr.html in your browser (double-click it). Chrome, Edge or Firefox are best. No internet is needed.',
  '',
  'Your life is saved in that browser, for this file in this folder. Keep the file where it is, and play it in the same',
  'browser, and the game will be there when you come back. To keep a life safe, or move it to another computer or',
  'browser, use Menu > Save as text, keep the code, and paste it into Load a saved life.',
  '',
  'Safari does not keep saves for a file opened from disk: on a Mac, use Chrome or Firefox, or use Save as text.',
  '',
  'No account, no ads, no analytics. Nothing leaves the page.',
  'Fonts: Alegreya, Alegreya Sans and Alegreya SC (Huerta Tipográfica) and Noto Sans Runic (Google), SIL Open Font',
  'License 1.1: the licences are in LICENSES. Map data: Natural Earth, public domain.',
  '',
].join('\r\n'));
for (const f of ['alegreya', 'alegreya-sans', 'alegreya-sc', 'noto-sans-runic']) copyFileSync(join(root, 'node_modules', '@fontsource', f, 'LICENSE'), join(stage, 'LICENSES', `${f}-OFL.txt`));
const zip = join(out, `vikingr-${version}-desktop.zip`);
rmSync(zip, { force: true });
execFileSync('zip', ['-qr', zip, `vikingr-${version}-desktop`], { cwd: out });
if (!existsSync(zip)) throw new Error('make-desktop: no zip');
console.log(`wrote release/vikingr-${version}-desktop.zip (${(statSync(zip).size / 1e6).toFixed(1)} MB): Vikingr.html ${(page.length / 1e6).toFixed(1)} MB, a readme, the font licences`);
