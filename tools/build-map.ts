// Builds the world map (src/content/map.json) from Natural Earth data.
// Run: npm run map. Downloads the source GeoJSON into .map-cache/ on first run.
//
// Natural Earth is public domain (naturalearthdata.com). The output is a tile
// grid of terrain codes, run-length encoded, plus river polylines in tile
// coordinates. Biomes are not in the source data: they come from the zone
// polygons below, latitude and a little value noise. Change a zone here and
// re-run; the validator re-checks every place against the new grid.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAP_GRID, TERRAIN, type Terrain, lonLatToTile, encodeRle } from '../src/engine/mapgrid';

const ROOT = join(import.meta.dirname, '..');
const CACHE = join(ROOT, '.map-cache');
const SRC = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const FILES = { land: 'ne_10m_land', lakes: 'ne_50m_lakes', rivers: 'ne_50m_rivers_lake_centerlines' } as const;

type Pt = [number, number];
type Ring = Pt[];
interface Feature { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } | null }

async function load(name: string): Promise<Feature[]> {
  const path = join(CACHE, `${name}.geojson`);
  if (!existsSync(path)) {
    mkdirSync(CACHE, { recursive: true });
    const res = await fetch(SRC + name + '.geojson');
    if (!res.ok) throw new Error(`download failed: ${name} ${res.status}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return (JSON.parse(readFileSync(path, 'utf8')) as { features: Feature[] }).features;
}

const { cols, rows, lonMin, lonMax, latMin, latMax } = MAP_GRID;
const PAD = 1;
const inBounds = ([lon, lat]: Pt) => lon > lonMin - PAD && lon < lonMax + PAD && lat > latMin - PAD && lat < latMax + PAD;

function ringsOf(f: Feature): Ring[] {
  const g = f.geometry;
  if (!g) return [];
  if (g.type === 'Polygon') return g.coordinates as Ring[];
  if (g.type === 'MultiPolygon') return (g.coordinates as Ring[][]).flat();
  return [];
}

function linesOf(f: Feature): Pt[][] {
  const g = f.geometry;
  if (!g) return [];
  if (g.type === 'LineString') return [g.coordinates as Pt[]];
  if (g.type === 'MultiLineString') return g.coordinates as Pt[][];
  return [];
}

/** Even-odd scanline fill with 3x3 supersampling. Marks a tile when at least 5 of 9 samples are inside. */
function rasterise(rings: Ring[]): Uint8Array {
  const rel = rings.filter((r) => r.some(inBounds));
  const hits = new Uint8Array(cols * rows);
  const S = 3;
  for (let r = 0; r < rows; r++) {
    for (let sy = 0; sy < S; sy++) {
      const lat = latMax - ((r + (sy + 0.5) / S) / rows) * (latMax - latMin);
      const xs: number[] = [];
      for (const ring of rel) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [x1, y1] = ring[i]!;
          const [x2, y2] = ring[j]!;
          if (y1 > lat !== y2 > lat) xs.push(x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = ((xs[k]! - lonMin) / (lonMax - lonMin)) * cols * S;
        const c1 = ((xs[k + 1]! - lonMin) / (lonMax - lonMin)) * cols * S;
        for (let sx = Math.max(0, Math.ceil(c0 - 0.5)); sx < Math.min(cols * S, Math.floor(c1 - 0.5) + 1); sx++) {
          hits[r * cols + Math.floor(sx / S)]!++;
        }
      }
    }
  }
  const out = new Uint8Array(cols * rows);
  for (let i = 0; i < hits.length; i++) out[i] = hits[i]! >= 5 ? 1 : 0;
  return out;
}

function inPoly(pt: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Deterministic value noise in [0,1). */
function hash(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x: number, y: number, scale: number): number {
  const fx = x / scale, fy = y / scale;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = hash(x0, y0), b = hash(x0 + 1, y0), c = hash(x0, y0 + 1), d = hash(x0 + 1, y0 + 1);
  return a + (b - a) * s(tx) + (c - a) * s(ty) + (a - b - c + d) * s(tx) * s(ty);
}

// Zones, in lon/lat. Coarse on purpose: they read as regions at map scale.
const MOUNTAINS: Pt[][] = [
  // the Scandinavian mountains (Kjølen), west of the watershed
  [[6.2, 59.0], [7.5, 58.9], [8.6, 59.7], [9.4, 61.2], [10.6, 62.3], [12.2, 62.9], [13.3, 64.4], [15.4, 66.6], [13.6, 66.6], [12.2, 65.1], [10.4, 63.6], [8.4, 62.8], [7.0, 62.1], [6.8, 61.1], [6.6, 60.2]],
  // Scottish Highlands
  [[-5.8, 56.3], [-4.2, 56.25], [-2.7, 56.9], [-3.0, 57.7], [-4.1, 58.4], [-5.1, 58.6], [-5.7, 57.6]],
  // Snowdonia and the Welsh uplands
  [[-4.3, 52.1], [-3.5, 52.1], [-3.4, 53.1], [-4.1, 53.25]],
  // Alps
  [[6.0, 45.0], [14.0, 45.6], [14.2, 47.3], [10.0, 47.6], [7.0, 46.8], [6.0, 46.3]],
  // Massif Central
  [[2.3, 45.0], [4.3, 45.0], [3.6, 45.9], [2.6, 45.9]],
  // Carpathians
  [[19.0, 49.6], [22.5, 49.4], [24.6, 48.1], [26.2, 47.1], [26.1, 45.4], [22.4, 45.0], [23.6, 47.4], [19.5, 49.1]],
];
const MOOR: Pt[][] = [
  // Scotland outside the Highlands, the Northern Isles, Faroes
  [[-8.0, 55.0], [-1.6, 55.6], [-1.5, 61.0], [-8.5, 62.5]],
  // the Pennines and the north of England
  [[-3.4, 53.3], [-1.6, 53.3], [-1.7, 55.6], [-3.3, 55.1]],
  // Wales
  [[-5.4, 51.6], [-2.9, 51.6], [-2.9, 53.4], [-4.8, 53.4]],
  // Devon and Cornwall
  [[-5.8, 49.9], [-3.4, 50.3], [-3.6, 51.2], [-5.8, 50.4]],
  // the west of Ireland
  [[-10.6, 51.4], [-8.8, 51.6], [-8.4, 54.2], [-8.6, 55.4], [-10.6, 54.4]],
  // west Norwegian coastal heath
  [[4.5, 58.6], [6.4, 58.6], [6.6, 61.0], [6.8, 62.1], [8.6, 63.4], [10.0, 64.6], [12.8, 66.6], [11.0, 66.6], [7.6, 63.6], [4.5, 62.0]],
];
const FARM: Pt[][] = [
  // Denmark and Skåne
  [[8.0, 54.4], [12.8, 54.4], [14.5, 55.3], [14.5, 56.3], [12.6, 56.5], [10.8, 57.9], [8.0, 57.2]],
  // Vestfold and the Oslofjord
  [[9.4, 58.9], [11.6, 58.9], [11.6, 60.1], [9.4, 60.1]],
  // the Mälaren basin and Uppland
  [[15.4, 58.9], [18.8, 59.1], [18.8, 60.5], [15.4, 60.2]],
  // Trøndelag
  [[9.8, 63.0], [11.8, 63.1], [11.8, 64.0], [10.6, 64.0]],
  // southern and eastern England
  [[-3.4, 50.3], [1.9, 50.8], [1.9, 53.0], [-0.2, 53.8], [-1.6, 55.0], [-1.7, 53.3], [-3.0, 52.0], [-3.6, 51.2]],
  // Frankia and the Low Countries inland
  [[-4.8, 45.0], [7.2, 45.0], [8.8, 49.5], [6.6, 51.5], [4.6, 51.2], [1.6, 51.0], [-1.8, 49.8], [-4.8, 48.8]],
  // eastern and central Ireland (pasture)
  [[-8.8, 51.6], [-5.9, 52.0], [-5.6, 54.6], [-8.4, 55.3], [-8.4, 54.2]],
];
const MARSH: Pt[][] = [
  // Frisian coast and the Rhine–Meuse delta
  [[3.3, 51.2], [5.2, 51.7], [7.0, 53.0], [9.0, 53.6], [9.0, 54.4], [8.2, 54.4], [6.6, 53.6], [4.6, 53.1], [3.4, 51.6]],
  // the Fens
  [[-0.6, 52.3], [0.5, 52.3], [0.5, 53.0], [-0.4, 53.0]],
];

// Rivers Natural Earth lacks at this scale, traced from the modern course.
const EXTRA_RIVERS: Record<string, Pt[]> = {
  Volkhov: [[31.28, 58.52], [31.6, 58.9], [32.0, 59.4], [32.3, 59.9], [32.33, 60.12]],
  Shannon: [[-7.92, 54.23], [-8.09, 53.95], [-7.98, 53.5], [-7.94, 53.42], [-7.99, 53.33], [-8.3, 53.0], [-8.63, 52.66], [-9.3, 52.6], [-9.7, 52.55]],
  Liffey: [[-6.6, 53.18], [-6.45, 53.33], [-6.27, 53.35], [-6.18, 53.34]],
  Ouse: [[-1.4, 54.2], [-1.08, 53.96], [-0.9, 53.75], [-0.6, 53.7], [-0.3, 53.72], [0.1, 53.6]],
  Trent: [[-2.0, 52.95], [-1.2, 52.9], [-0.75, 53.3], [-0.7, 53.7]],
  Somme: [[3.2, 49.85], [2.3, 49.9], [1.6, 50.18]],
};
const RIVER_NAMES = new Set(['Seine', 'Loire', 'Rhine', 'Rhein', 'Rhin', 'Nederrijn', 'Lek', 'Waal', 'Elbe', 'Oder', 'Vistula', 'Daugava', 'Neva', "Svir’", 'Thames', 'Garonne', 'Dnipro', 'Dnepre', 'Glomma', 'Göta älv', 'Dalälven', 'Volga']);
// modern reservoirs and canals left out of a 9th-century map
const LAKE_SKIP = /Reservoir|Csatorna|IJsselmeer/;

async function main() {
  const land = rasterise((await load(FILES.land)).flatMap(ringsOf));
  const lakeFeatures = (await load(FILES.lakes)).filter((f) => !LAKE_SKIP.test(String(f.properties.name ?? '')));
  const lakes = rasterise(lakeFeatures.flatMap(ringsOf));

  // distance from land, for sea depth
  const dist = new Int16Array(cols * rows).fill(-1);
  const q: number[] = [];
  for (let i = 0; i < land.length; i++) if (land[i] && !lakes[i]) { dist[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h]!;
    const x = i % cols, y = (i / cols) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const j = ny * cols + nx;
      if (dist[j] === -1) { dist[j] = dist[i]! + 1; q.push(j); }
    }
  }

  const tiles = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const lon = lonMin + ((x + 0.5) / cols) * (lonMax - lonMin);
      const lat = latMax - ((y + 0.5) / rows) * (latMax - latMin);
      // warp the sample point so zone edges wander like real regions do
      const p: Pt = [lon + (noise(x, y, 9) - 0.5) * 1.6 + (noise(x + 500, y, 3) - 0.5) * 0.5, lat + (noise(x, y + 500, 9) - 0.5) * 0.9];
      let t: Terrain;
      if (!land[i]) t = dist[i]! <= 2 ? 'shallows' : dist[i]! <= 9 ? 'sea' : 'deep';
      else if (lakes[i]) t = 'lake';
      else if (MOUNTAINS.some((z) => inPoly(p, z))) t = noise(x + 900, y, 4) > (lat > 61 ? 0.7 : 0.8) ? 'ice' : 'mountain';
      else if (MARSH.some((z) => inPoly(p, z))) t = 'marsh';
      else if (MOOR.some((z) => inPoly(p, z))) t = noise(x, y, 4) > 0.8 ? 'forest' : 'moor';
      else if (FARM.some((z) => inPoly(p, z))) t = noise(x, y, 6) > 0.7 ? 'forest' : 'farm';
      else if (p[1] > 65.4) t = 'fell';
      else t = noise(x, y, 5) > 0.86 ? 'farm' : 'forest';
      tiles[i] = TERRAIN.indexOf(t);
    }
  }

  const rivers: { name: string; pts: number[] }[] = [];
  const addRiver = (name: string, line: Pt[]) => {
    if (!line.some(inBounds)) return;
    const pts: number[] = [];
    for (const pt of line) {
      const [tx, ty] = lonLatToTile(pt[0], pt[1]);
      pts.push(Math.round(tx * 10) / 10, Math.round(ty * 10) / 10);
    }
    rivers.push({ name, pts });
  };
  for (const f of await load(FILES.rivers)) {
    const name = String(f.properties.name ?? '');
    if (RIVER_NAMES.has(name)) for (const l of linesOf(f)) addRiver(name, l);
  }
  for (const [name, line] of Object.entries(EXTRA_RIVERS)) addRiver(name, line);

  const out = { cols, rows, terrain: TERRAIN, rle: encodeRle(tiles), rivers };
  const path = join(ROOT, 'src', 'content', 'map.json');
  writeFileSync(path, JSON.stringify(out));
  const counts: Record<string, number> = {};
  for (const v of tiles) counts[TERRAIN[v]!] = (counts[TERRAIN[v]!] ?? 0) + 1;
  console.log(`map: ${cols}x${rows}, ${rivers.length} river lines, ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
  console.log(Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', '));
}

await main();
