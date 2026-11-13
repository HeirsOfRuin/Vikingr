// The itch.io upload (docs/game-building release checklist): dist/ from a release build (`npm run build:itch` runs
// this after VITE_RELEASE=1 vite build), without the service worker (itch serves from a shared origin, and a frame
// can't install anyway), with the fonts' licences beside them, zipped with index.html at the zip root.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist');
const out = join(root, 'release');
const version = (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string }).version;
if (!existsSync(join(dist, 'index.html'))) throw new Error('make-itch: no dist/index.html; run npm run build:itch');

// no service worker on itch
for (const f of ['sw.js']) rmSync(join(dist, f), { force: true });
const html = readFileSync(join(dist, 'index.html'), 'utf8');
if (/serviceWorker\.register/.test(readFileSync(join(dist, 'index.html'), 'utf8'))) throw new Error('make-itch: index.html registers a service worker');
if (!html.includes('./assets/')) throw new Error('make-itch: asset paths are not relative (vite base must be ./)');

// the fonts' licences go with the fonts (SIL OFL 1.1)
const lic = join(dist, 'LICENSES');
mkdirSync(lic, { recursive: true });
for (const f of ['alegreya', 'alegreya-sans', 'alegreya-sc', 'noto-sans-runic']) {
  const src = join(root, 'node_modules', '@fontsource', f, 'LICENSE');
  if (!existsSync(src)) throw new Error(`make-itch: no licence for ${f}`);
  copyFileSync(src, join(lic, `${f}-OFL.txt`));
}

// the bundle must not carry the playtest jumps or the debug dump
const js = readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(dist, 'assets', f), 'utf8')).join('\n');
for (const s of ['Play from a chapter', 'Playtest chapter: not saved']) if (js.includes(s)) throw new Error(`make-itch: the release bundle still has "${s}"`);

mkdirSync(out, { recursive: true });
const zip = join(out, `vikingr-${version}-itch.zip`);
rmSync(zip, { force: true });
execFileSync('zip', ['-qr', zip, '.'], { cwd: dist });
const list = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).split('\n').filter(Boolean);
if (!list.includes('index.html')) throw new Error('make-itch: index.html is not at the zip root');
const size = (p: string): number => statSync(p).isDirectory() ? readdirSync(p).reduce((n, f) => n + size(join(p, f)), 0) : statSync(p).size;
console.log(`wrote ${relative(root, zip)}: ${list.length} files, ${(statSync(zip).size / 1e6).toFixed(1)} MB zipped (${(size(dist) / 1e6).toFixed(1)} MB unpacked), index.html at the root`);
