// A short look at the 843 opening on a phone (docs/FRAME-LINEAGE.md D): the era card, the news, the first scenes.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';
const DIST = join(import.meta.dirname, '..', 'dist');
const OUT = join(import.meta.dirname, '..', 'smoke-out');
mkdirSync(OUT, { recursive: true });
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const p = join(DIST, decodeURIComponent((req.url ?? '/').split('?')[0]!));
  const f = existsSync(p) && !p.endsWith('/') ? p : join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' });
  res.end(readFileSync(f));
}).listen(0);
const port = (server.address() as { port: number }).port;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${port}/`);
await page.getByRole('button', { name: /Begin a new life/ }).click();
await page.getByRole('button', { name: /Ragnarr's days/ }).click();
await page.getByRole('button', { name: /^Next/ }).click();
await page.getByRole('button', { name: /^Begin/ }).click();
await page.screenshot({ path: join(OUT, '843-1-news.png'), fullPage: true });
await page.getByRole('button', { name: /^Continue/ }).click();
await page.screenshot({ path: join(OUT, '843-2-boyhood.png'), fullPage: true });
await browser.close();
server.close();
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
console.log('smoke-843: ok');
