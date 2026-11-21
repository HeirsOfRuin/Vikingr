// The desktop download: the whole release game in one HTML file that opens from a downloads folder and
// plays with no network. Run: npm run build:single (a release build with every asset inlined, then this).
// Same packing as tools/build-artifact.ts, but a whole page (doctype, charset, viewport), and checked to be
// the release game: no playtest chapter jumps, no debug dump, not the demo.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist-artifact-build');
const version = (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string }).version;
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const js = [...html.matchAll(/<script[^>]*src="\.?\/?([^"]+)"[^>]*><\/script>/g)].map((m) => readFileSync(join(dist, m[1]!), 'utf8'));
const css = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="\.?\/?([^"]+)"[^>]*>/g)].map((m) => readFileSync(join(dist, m[1]!), 'utf8'));
if (!js.length) throw new Error('make-single: no script found; run npm run build:single');
const all = js.join('\n') + css.join('\n');
if (/\.\/assets\//.test(all)) throw new Error('make-single: an asset was not inlined: the download would show broken pictures or fonts');
for (const s of ['Play from a chapter', 'Playtest chapter: not saved', 'The free demo: the first two years']) {
  if (all.includes(s)) throw new Error(`make-single: the download still has "${s}" (not a full release build)`);
}

const safe = (s: string) => s.replace(/<\/script/gi, '<\\/script');
const out = [
  '<!doctype html>',
  '<html lang="en"><head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  '<meta name="theme-color" content="#191b1c">',
  '<title>Vikingr</title>',
  `<style>${css.join('\n')}</style>`,
  '</head><body>',
  '<div id="app"></div>',
  `<script type="module">${safe(js.join('\n'))}</script>`,
  '</body></html>',
  '',
].join('\n');
mkdirSync(join(root, 'release'), { recursive: true });
const file = join(root, 'release', `vikingr-${version}.html`);
writeFileSync(file, out);
// the fonts' licences travel with a download (SIL OFL 1.1): beside the file in the release folder
mkdirSync(join(root, 'release', 'LICENSES'), { recursive: true });
for (const f of ['alegreya', 'alegreya-sans', 'alegreya-sc', 'noto-sans-runic']) {
  copyFileSync(join(root, 'node_modules', '@fontsource', f, 'LICENSE'), join(root, 'release', 'LICENSES', `${f}-OFL.txt`));
}
// the itch download: the file, the licences and a short note, zipped (release/vikingr-<v>-download.zip)
writeFileSync(join(root, 'release', 'README.txt'), [
  `Vikingr ${version}`, '',
  `Open vikingr-${version}.html in Chrome, Edge or Firefox. It plays offline and needs nothing else.`,
  'Your life is saved in that browser. Safari will not keep saves from a file: use another browser.',
  'To move a life, open the menu and choose Save as text, then Load a saved life on the title screen.',
  'A save code from the free demo loads here and goes on from the same spring.', '',
  'The fonts are under the SIL Open Font License 1.1: the licences are in LICENSES.', '',
].join('\n'));
const dl = join(root, 'release', `vikingr-${version}-download.zip`);
rmSync(dl, { force: true });
execFileSync('zip', ['-qr', dl, `vikingr-${version}.html`, 'README.txt', 'LICENSES'], { cwd: join(root, 'release') });
console.log(`wrote release/vikingr-${version}.html (${(out.length / 1e6).toFixed(1)} MB), one file, plays offline`);
console.log(`wrote release/vikingr-${version}-download.zip: the file, README.txt and LICENSES`);
