// Paints the world map once, as pixel art, into a canvas. 3 canvas pixels per tile:
// a palette per terrain, a 3×3 pattern per terrain, hash noise for variation, foam on coasts.
import { mapTiles, TERRAIN, type MapData, type Terrain } from '../engine/mapgrid';

export const PX = 3;

const BASE: Record<Terrain, [number, number, number]> = {
  deep: [26, 44, 60],
  sea: [34, 60, 84],
  shallows: [48, 86, 110],
  lake: [56, 96, 122],
  farm: [132, 128, 74],
  forest: [52, 76, 46],
  moor: [112, 104, 74],
  marsh: [84, 100, 70],
  mountain: [124, 118, 108],
  ice: [214, 218, 218],
  fell: [140, 140, 112],
};

// 3x3 patterns: 0 = base, 1 = lighter, 2 = darker, 3 = accent
const PATTERN: Partial<Record<Terrain, number[]>> = {
  forest: [0, 3, 0, 3, 2, 3, 0, 2, 0],
  farm: [0, 0, 0, 1, 1, 1, 2, 0, 0],
  moor: [0, 2, 0, 0, 0, 1, 1, 0, 0],
  marsh: [0, 3, 0, 0, 0, 0, 0, 1, 3],
  mountain: [0, 1, 0, 1, 1, 2, 2, 2, 2],
  fell: [0, 0, 1, 0, 2, 0, 1, 0, 0],
};
const ACCENT: Partial<Record<Terrain, [number, number, number]>> = {
  forest: [36, 56, 34],
  marsh: [60, 96, 112],
};

function hash(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const cache = new WeakMap<MapData, HTMLCanvasElement>();

export function worldCanvas(map: MapData): HTMLCanvasElement {
  const hit = cache.get(map);
  if (hit) return hit;
  const tiles = mapTiles(map);
  const W = map.cols * PX;
  const H = map.rows * PX;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= map.cols || y >= map.rows ? 0 : tiles[y * map.cols + x]!);
  const isWater = (v: number) => v <= 3;
  for (let ty = 0; ty < map.rows; ty++) {
    for (let tx = 0; tx < map.cols; tx++) {
      const v = at(tx, ty);
      const t = TERRAIN[v]!;
      const base = BASE[t];
      const jitter = (hash(tx, ty) - 0.5) * 14;
      const pat = PATTERN[t];
      const water = isWater(v);
      const coast = water && v !== 3 && (!isWater(at(tx + 1, ty)) || !isWater(at(tx - 1, ty)) || !isWater(at(tx, ty + 1)) || !isWater(at(tx, ty - 1)));
      // shade land by its north-west neighbour: a little relief
      const shade = !water && isWater(at(tx - 1, ty - 1)) ? 10 : 0;
      for (let py = 0; py < PX; py++) {
        for (let px = 0; px < PX; px++) {
          let [r, g, b] = base;
          const p = pat ? pat[py * 3 + px]! : 0;
          if (p === 1) { r += 16; g += 16; b += 12; }
          else if (p === 2) { r -= 14; g -= 14; b -= 12; }
          else if (p === 3) [r, g, b] = ACCENT[t] ?? base;
          if (water && !coast && hash(tx * 3 + px, ty * 3 + py) > 0.985) { r += 22; g += 26; b += 28; }
          if (coast && (px + py) % 2 === 0) { r += 30; g += 34; b += 34; }
          r += jitter + shade; g += jitter + shade; b += jitter * 0.6 + shade;
          const i = ((ty * PX + py) * W + tx * PX + px) * 4;
          d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  // rivers
  ctx.strokeStyle = 'rgb(76, 116, 146)';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  for (const r of map.rivers) {
    ctx.beginPath();
    for (let k = 0; k < r.pts.length; k += 2) ctx[k ? 'lineTo' : 'moveTo'](r.pts[k]! * PX, r.pts[k + 1]! * PX);
    ctx.stroke();
  }
  cache.set(map, canvas);
  return canvas;
}
