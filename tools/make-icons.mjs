// Renders the app icons (public/icons) from an inline SVG with the preinstalled Chromium. Run: node tools/make-icons.mjs
import { chromium } from 'playwright';
// a longship under a square sail, on a dark sea
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" fill="#14171a"/>
<g transform="translate(${pad} ${pad}) scale(${(512 - 2 * pad) / 512})">
<path d="M256 70v260" stroke="#d8cfb8" stroke-width="16"/>
<path d="M150 96h212v196H150z" fill="#8a2f24" stroke="#d8cfb8" stroke-width="12"/>
<path d="M150 150h212M150 204h212M150 258h212" stroke="#d8cfb8" stroke-width="8" opacity=".55"/>
<path d="M52 336C30 290 36 236 84 214M460 336C482 290 476 236 428 214" stroke="#b08a4a" stroke-width="22" fill="none" stroke-linecap="round"/>
<path d="M40 330h432c-20 44-60 76-110 84H150c-50-8-90-40-110-84z" fill="#b08a4a" stroke="#d8cfb8" stroke-width="12"/>
<path d="M70 450h372" stroke="#3d5a73" stroke-width="14" stroke-linecap="round"/>
</g></svg>`;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const p = await b.newPage();
for (const [name, size, pad] of [['icon-192.png', 192, 30], ['icon-512.png', 512, 30], ['maskable-512.png', 512, 100], ['apple-touch-icon.png', 180, 30]]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<html><body style="margin:0">${svg(pad).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await p.screenshot({ path: `public/icons/${name}`, omitBackground: false });
}
await b.close();
