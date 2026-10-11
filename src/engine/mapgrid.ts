// The world grid: an equirectangular projection of the North Sea world,
// with longitude squeezed by cos(56°) so tiles are roughly square on the ground.
// Shared by the map generator (tools/build-map.ts), the engine and the UI.

export const MAP_GRID = {
  lonMin: -16,
  lonMax: 34,
  latMin: 45,
  latMax: 66.5,
  cols: 468,
  rows: 360,
} as const;

/** Terrain codes, in storage order. The index is what map.json stores: append only. */
export const TERRAIN = ['deep', 'sea', 'shallows', 'lake', 'farm', 'forest', 'moor', 'marsh', 'mountain', 'ice', 'fell'] as const;
export type Terrain = (typeof TERRAIN)[number];
export const WATER: ReadonlySet<Terrain> = new Set(['deep', 'sea', 'shallows', 'lake']);

/** Fractional tile coordinates for a longitude/latitude. */
export function lonLatToTile(lon: number, lat: number): [number, number] {
  const { lonMin, lonMax, latMin, latMax, cols, rows } = MAP_GRID;
  return [((lon - lonMin) / (lonMax - lonMin)) * cols, ((latMax - lat) / (latMax - latMin)) * rows];
}

/** Approximate kilometres per tile (north–south). */
export const KM_PER_TILE = ((MAP_GRID.latMax - MAP_GRID.latMin) / MAP_GRID.rows) * 111.2;

/** Great-circle distance in km. */
export function distanceKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Run-length encoding: "<code><count base36>" runs joined by ".". */
export function encodeRle(tiles: Uint8Array): string {
  const out: string[] = [];
  let i = 0;
  while (i < tiles.length) {
    const v = tiles[i]!;
    let n = 1;
    while (i + n < tiles.length && tiles[i + n] === v) n++;
    out.push(v.toString(36) + n.toString(36));
    i += n;
  }
  return out.join('.');
}

export function decodeRle(rle: string, size: number): Uint8Array {
  const tiles = new Uint8Array(size);
  let i = 0;
  for (const run of rle.split('.')) {
    const v = parseInt(run[0]!, 36);
    const n = parseInt(run.slice(1), 36);
    tiles.fill(v, i, i + n);
    i += n;
  }
  if (i !== size) throw new Error(`map RLE decodes to ${i} tiles, expected ${size}`);
  return tiles;
}

export interface MapData {
  cols: number;
  rows: number;
  terrain: readonly string[];
  rle: string;
  rivers: { name: string; pts: number[] }[];
}

const decoded = new WeakMap<MapData, Uint8Array>();
export function mapTiles(map: MapData): Uint8Array {
  let t = decoded.get(map);
  if (!t) {
    t = decodeRle(map.rle, map.cols * map.rows);
    decoded.set(map, t);
  }
  return t;
}

export function terrainAt(map: MapData, x: number, y: number): Terrain {
  const xi = Math.floor(x), yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= map.cols || yi >= map.rows) return 'deep';
  return TERRAIN[mapTiles(map)[yi * map.cols + xi]!]!;
}
