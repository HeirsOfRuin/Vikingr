// Sea routes on the map (playtest 8: "all routes in straight lines, not realistic routes that follow coasts"). Each leg
// is found once, at content build, as the cheapest path over the map's water and rivers; open water costs more the
// further it is from land, so ships keep to the coast unless the open sea is much shorter, as a steersman did. The
// map draws the path and the ship moves along it. Days at sea still come from the leg, not from the path.
import { mapTiles, TERRAIN, type MapData } from './mapgrid';

export const SEAWAY = {
  /** Extra cost a step of water carries for each tile it lies from land, up to `far` tiles. */
  offshore: 0.1,
  far: 6,
  /** A step over land: only to get a port that stands back from the water out to sea. */
  land: 30,
  /** Simplification tolerance, in tiles. */
  tolerance: 0.6,
} as const;

/** Leg key: the two place ids, in the order the leg is written. */
export const legKey = (a: string, b: string) => `${a}|${b}`;

interface Grid {
  cols: number;
  rows: number;
  /** Cost of entering a tile. */
  cost: Float32Array;
}

const WATER_IDS = new Set(['deep', 'sea', 'shallows', 'lake'].map((t) => TERRAIN.indexOf(t as (typeof TERRAIN)[number])));

/** The cost of entering each tile: water by its distance from land, rivers as coast, land dear. */
export function seaGrid(map: MapData): Grid {
  const { cols, rows } = map;
  const tiles = mapTiles(map);
  const water = new Uint8Array(cols * rows);
  for (let i = 0; i < tiles.length; i++) if (WATER_IDS.has(tiles[i]!)) water[i] = 1;
  // rivers are drawn as lines, not tiles: rasterize them as water a ship can row up
  for (const r of map.rivers) {
    for (let k = 0; k + 3 < r.pts.length; k += 2) {
      const [x0, y0, x1, y1] = [r.pts[k]!, r.pts[k + 1]!, r.pts[k + 2]!, r.pts[k + 3]!];
      const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2) + 1;
      for (let s = 0; s <= n; s++) {
        const x = Math.floor(x0 + ((x1 - x0) * s) / n), y = Math.floor(y0 + ((y1 - y0) * s) / n);
        if (x >= 0 && y >= 0 && x < cols && y < rows) water[y * cols + x] = 1;
      }
    }
  }
  // distance from land, by a breadth-first sweep out from every coast
  const dist = new Int16Array(cols * rows).fill(-1);
  const q: number[] = [];
  for (let i = 0; i < water.length; i++) if (!water[i]) { dist[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h]!;
    if (dist[i]! >= SEAWAY.far) continue;
    const x = i % cols, y = (i / cols) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const j = ny * cols + nx;
      if (dist[j] === -1) { dist[j] = dist[i]! + 1; q.push(j); }
    }
  }
  const cost = new Float32Array(cols * rows);
  for (let i = 0; i < cost.length; i++) {
    cost[i] = water[i] ? 1 + SEAWAY.offshore * Math.max(0, (dist[i] === -1 ? SEAWAY.far : dist[i]!) - 1) : SEAWAY.land;
  }
  return { cols, rows, cost };
}

/** A small binary heap of [priority, index]. */
class Heap {
  private p: number[] = [];
  private v: number[] = [];
  get size() { return this.v.length; }
  push(pri: number, val: number) {
    const p = this.p, v = this.v;
    let i = v.length;
    p.push(pri); v.push(val);
    while (i > 0) {
      const u = (i - 1) >> 1;
      if (p[u]! <= p[i]!) break;
      [p[u], p[i]] = [p[i]!, p[u]!]; [v[u], v[i]] = [v[i]!, v[u]!];
      i = u;
    }
  }
  pop(): number {
    const p = this.p, v = this.v;
    const top = v[0]!;
    const lp = p.pop()!, lv = v.pop()!;
    if (v.length) {
      p[0] = lp; v[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < v.length && p[l]! < p[m]!) m = l;
        if (r < v.length && p[r]! < p[m]!) m = r;
        if (m === i) break;
        [p[m], p[i]] = [p[i]!, p[m]!]; [v[m], v[i]] = [v[i]!, v[m]!];
        i = m;
      }
    }
    return top;
  }
}

const STEPS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]] as const;

/** The cheapest path between two tile points (A*), as a flat [x, y, ...] list of tile centres, simplified. */
export function seaRoute(g: Grid, from: [number, number], to: [number, number]): number[] {
  const { cols, rows, cost } = g;
  const s = Math.floor(from[1]) * cols + Math.floor(from[0]);
  const t = Math.floor(to[1]) * cols + Math.floor(to[0]);
  const gs = new Float64Array(cols * rows).fill(Infinity);
  const prev = new Int32Array(cols * rows).fill(-1);
  const tx = t % cols, ty = (t / cols) | 0;
  const hfun = (i: number) => Math.hypot((i % cols) - tx, ((i / cols) | 0) - ty);
  const open = new Heap();
  gs[s] = 0;
  open.push(hfun(s), s);
  while (open.size) {
    const i = open.pop();
    if (i === t) break;
    const x = i % cols, y = (i / cols) | 0;
    for (const [dx, dy, len] of STEPS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const j = ny * cols + nx;
      // no cutting a corner of land on a diagonal
      if (dx && dy && (cost[y * cols + nx]! >= SEAWAY.land || cost[ny * cols + x]! >= SEAWAY.land) && cost[j]! < SEAWAY.land) continue;
      const ng = gs[i]! + len * (cost[i]! + cost[j]!) / 2;
      if (ng < gs[j]!) { gs[j] = ng; prev[j] = i; open.push(ng + hfun(j), j); }
    }
  }
  const pts: [number, number][] = [];
  for (let i = t; i !== -1; i = prev[i]!) { pts.push([(i % cols) + 0.5, ((i / cols) | 0) + 0.5]); if (i === s) break; }
  pts.reverse();
  pts[0] = from;
  pts[pts.length - 1] = to;
  return simplify(pts, SEAWAY.tolerance, g).flatMap(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
}

/** Ramer-Douglas-Peucker, refusing any shortcut that would cross land. */
function simplify(pts: [number, number][], eps: number, g: Grid): [number, number][] {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    if (b - a < 2) continue;
    const [ax, ay] = pts[a]!, [bx, by] = pts[b]!;
    const L = Math.hypot(bx - ax, by - ay) || 1;
    let worst = -1, wd = 0;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i]!;
      const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / L;
      if (d > wd) { wd = d; worst = i; }
    }
    if (worst === -1) worst = (a + b) >> 1;
    if (wd > eps || crossesLand(g, pts[a]!, pts[b]!)) { keep[worst] = 1; stack.push([a, worst], [worst, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

function crossesLand(g: Grid, [x0, y0]: [number, number], [x1, y1]: [number, number]): boolean {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 3);
  // the ends are ports, which may stand on land: only the water between them counts
  for (let s = 2; s < n - 1; s++) {
    const x = Math.floor(x0 + ((x1 - x0) * s) / n), y = Math.floor(y0 + ((y1 - y0) * s) / n);
    if (g.cost[y * g.cols + x]! >= SEAWAY.land) return true;
  }
  return false;
}

/** The point a fraction f of the way along a path, by distance. */
export function alongPath(path: readonly number[], f: number): [number, number] {
  const n = path.length / 2;
  if (n < 2) return [path[0] ?? 0, path[1] ?? 0];
  let total = 0;
  for (let i = 1; i < n; i++) total += Math.hypot(path[2 * i]! - path[2 * i - 2]!, path[2 * i + 1]! - path[2 * i - 1]!);
  let want = Math.max(0, Math.min(1, f)) * total;
  for (let i = 1; i < n; i++) {
    const seg = Math.hypot(path[2 * i]! - path[2 * i - 2]!, path[2 * i + 1]! - path[2 * i - 1]!);
    if (want <= seg || i === n - 1) {
      const k = seg ? Math.min(1, want / seg) : 0;
      return [path[2 * i - 2]! + (path[2 * i]! - path[2 * i - 2]!) * k, path[2 * i - 1]! + (path[2 * i + 1]! - path[2 * i - 1]!) * k];
    }
    want -= seg;
  }
  return [path[path.length - 2]!, path[path.length - 1]!];
}
