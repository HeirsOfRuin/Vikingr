// Packs the artifact build into one self-contained HTML fragment for a claude.ai preview
// (the host supplies <html>/<head>/<body>). Run: npm run build:artifact
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist-artifact-build');
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const js = [...html.matchAll(/<script[^>]*src="\.?\/?([^"]+)"[^>]*><\/script>/g)].map((m) => readFileSync(join(dist, m[1]!), 'utf8'));
const css = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="\.?\/?([^"]+)"[^>]*>/g)].map((m) => readFileSync(join(dist, m[1]!), 'utf8'));
if (!js.length) throw new Error('no script found; run the artifact build first');
if (/\.\/assets\//.test(js.join('') + css.join(''))) throw new Error('an asset was not inlined: the preview would show broken pictures or fonts');

const safe = (s: string) => s.replace(/<\/script/gi, '<\\/script');
const out = [
  '<title>Vikingr</title>',
  '<meta name="theme-color" content="#191b1c">',
  `<style>${css.join('\n')}</style>`,
  '<div id="app"></div>',
  `<script type="module">${safe(js.join('\n'))}</script>`,
  '',
].join('\n');
mkdirSync(join(root, 'dist-artifact'), { recursive: true });
const file = join(root, 'dist-artifact', 'vikingr.html');
writeFileSync(file, out);
console.log(`wrote ${file} (${(out.length / 1024).toFixed(0)} KB)`);
