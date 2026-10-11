// Converts source images (art/src/<key>.png|jpg|webp) into the game's pixel art (src/art/<key>.png).
// Usage: npx tsx tools/art.ts [key ...]       (no keys: every source)
//        npx tsx tools/art.ts --sheet out.png (also writes a contact sheet at phone size)
//
// The method (DESIGN §19b):
// 1. Crop to the band's 2.5:1 shape around a centre (art/art.json gives cx, cy per key; default the middle).
// 2. Scale to 400 × 160 with area averaging.
// 3. Snap every pixel to the fixed master palette below, nearest in OKLab. No dithering:
//    on painted or photographic sources it turns to checkerboard noise (the Silk Road lesson).
// Runs in the preinstalled Chromium so any image format a browser reads will do.
import { chromium } from 'playwright';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { MASTER } from '../src/ui/scene/palette';

export const ART_W = 400;
export const ART_H = 160;

export { MASTER } from '../src/ui/scene/palette';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'art', 'src');
const OUT = join(ROOT, 'src', 'art');
const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

const args = process.argv.slice(2);
const sheetAt = args.indexOf('--sheet');
const sheet = sheetAt >= 0 ? args[sheetAt + 1] : null;
const wanted = args.filter((a, i) => !a.startsWith('--') && i !== sheetAt + 1);
const centres = existsSync(join(ROOT, 'art', 'art.json')) ? (JSON.parse(readFileSync(join(ROOT, 'art', 'art.json'), 'utf8')) as Record<string, { cx?: number; cy?: number }>) : {};
const sources = readdirSync(SRC)
  .filter((f) => MIME[extname(f).toLowerCase()] && !f.startsWith('_'))
  .map((f) => ({ key: f.slice(0, -extname(f).length), file: join(SRC, f) }))
  .filter((s) => !wanted.length || wanted.includes(s.key));
if (!sources.length) {
  console.error(`art: no sources${wanted.length ? ' for ' + wanted.join(', ') : ''} in art/src/`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
// tsx names inner functions with a __name helper; the page needs it too
await page.evaluate('window.__name = (f) => f');

const results: { key: string; png: string; used: number; src: [number, number] }[] = [];
for (const s of sources) {
  const uri = `data:${MIME[extname(s.file).toLowerCase()]};base64,${readFileSync(s.file).toString('base64')}`;
  const c = centres[s.key] ?? {};
  const r = await page.evaluate(
    async ({ uri, W, H, cx, cy, palette }) => {
      const img = new Image();
      img.src = uri;
      await img.decode();
      // crop to W:H around the centre
      const ratio = W / H;
      let sw = img.naturalWidth, sh = img.naturalHeight;
      if (sw / sh > ratio) sw = Math.round(sh * ratio); else sh = Math.round(sw / ratio);
      const sx = Math.max(0, Math.min(img.naturalWidth - sw, Math.round(img.naturalWidth * cx - sw / 2)));
      const sy = Math.max(0, Math.min(img.naturalHeight - sh, Math.round(img.naturalHeight * cy - sh / 2)));
      // scale in halving steps for clean area averaging
      let src: CanvasImageSource = img;
      let w = sw, h = sh, x0 = sx, y0 = sy;
      while (w / 2 >= W && h / 2 >= H) {
        const t = document.createElement('canvas');
        t.width = Math.round(w / 2); t.height = Math.round(h / 2);
        const tg = t.getContext('2d')!;
        tg.imageSmoothingQuality = 'high';
        tg.drawImage(src, x0, y0, w, h, 0, 0, t.width, t.height);
        src = t; w = t.width; h = t.height; x0 = 0; y0 = 0;
      }
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const g = cv.getContext('2d')!;
      g.imageSmoothingQuality = 'high';
      g.drawImage(src, x0, y0, w, h, 0, 0, W, H);
      const d = g.getImageData(0, 0, W, H);
      // OKLab nearest colour
      const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      const lab = (r: number, gg: number, b: number): [number, number, number] => {
        const R = lin(r), G = lin(gg), B = lin(b);
        const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
        const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
        const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
        return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
      };
      const pal = palette.map((h): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
      const palLab = pal.map(([r, gg, b]) => lab(r, gg, b));
      const used = new Set<number>();
      const memo = new Map<number, number>();
      const px = d.data;
      for (let i = 0; i < px.length; i += 4) {
        const r0 = px[i]!, g0 = px[i + 1]!, b0 = px[i + 2]!;
        const key = (r0 >> 2 << 12) | (g0 >> 2 << 6) | (b0 >> 2);
        let best = memo.get(key);
        if (best === undefined) {
          const [L, A, Bb] = lab(r0, g0, b0);
          let bd = Infinity;
          best = 0;
          palLab.forEach(([pl, pa, pb], k) => {
            // weight lightness a little more: silhouettes and light carry the image
            const dd = 1.3 * (L - pl) ** 2 + (A - pa) ** 2 + (Bb - pb) ** 2;
            if (dd < bd) { bd = dd; best = k; }
          });
          memo.set(key, best);
        }
        used.add(best);
        const p = pal[best]!;
        px[i] = p[0]; px[i + 1] = p[1]; px[i + 2] = p[2]; px[i + 3] = 255;
      }
      g.putImageData(d, 0, 0);
      return { png: cv.toDataURL('image/png'), used: used.size, src: [img.naturalWidth, img.naturalHeight] as [number, number] };
    },
    { uri, W: ART_W, H: ART_H, cx: c.cx ?? 0.5, cy: c.cy ?? 0.5, palette: [...MASTER] },
  );
  writeFileSync(join(OUT, `${s.key}.png`), Buffer.from(r.png.split(',')[1]!, 'base64'));
  results.push({ key: s.key, ...r });
  const small = r.src[0] < ART_W || r.src[1] < ART_H;
  console.log(`art: ${s.key.padEnd(14)} ${r.src[0]}×${r.src[1]} → ${ART_W}×${ART_H}, ${r.used} colours${small ? '  (source smaller than the band: upscaled, softer)' : ''}`);
}

if (sheet) {
  // contact sheet at true phone size: each band as wide as a 390px phone, 2x device pixels, nearest-neighbour
  const cells = results.map((r) => `<figure><img src="${r.png}"><figcaption>${r.key} · ${r.used} colours</figcaption></figure>`).join('');
  const p2 = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
  await p2.setContent(`<style>body{margin:0;padding:12px;background:#191b1c;display:grid;grid-template-columns:repeat(3,358px);gap:12px}figure{margin:0}img{width:358px;image-rendering:pixelated;display:block}figcaption{color:#b5ac97;font:12px system-ui;margin-top:4px}</style>${cells}`);
  await p2.screenshot({ path: sheet, fullPage: true });
  console.log(`art: contact sheet → ${sheet}`);
}
await browser.close();
