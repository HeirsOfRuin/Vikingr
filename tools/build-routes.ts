// Sea routes for every leg (src/engine/seaway.ts), written to src/content/routes.json. Cached: the routes are found
// again only when the map or a leg's ports change.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { ContentBundle } from '../src/content/schema';
import { lonLatToTile, type MapData } from '../src/engine/mapgrid';
import { legKey, SEAWAY, seaGrid, seaRoute } from '../src/engine/seaway';

const OUT = join(import.meta.dirname, '..', 'src', 'content', 'routes.json');

export function buildRoutes(bundle: ContentBundle): { routes: Record<string, number[]>; fresh: boolean } {
  const map = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'src', 'content', 'map.json'), 'utf8')) as MapData;
  const ends = bundle.legs.map((l) => [l.a, l.b, ...[l.a, l.b].map((id) => { const p = bundle.places[id]!; return `${p.lon},${p.lat}`; })].join(' '));
  const hash = createHash('sha1').update(map.rle).update(JSON.stringify(SEAWAY)).update(readFileSync(join(import.meta.dirname, '..', 'src', 'engine', 'seaway.ts'))).update(ends.join(';')).digest('hex').slice(0, 12);
  if (existsSync(OUT)) {
    const old = JSON.parse(readFileSync(OUT, 'utf8')) as { hash: string; routes: Record<string, number[]> };
    if (old.hash === hash) return { routes: old.routes, fresh: false };
  }
  const g = seaGrid(map);
  const routes: Record<string, number[]> = {};
  for (const l of bundle.legs) {
    if (l.kind === 'land') continue; // a road is drawn straight
    const a = bundle.places[l.a]!, b = bundle.places[l.b]!;
    routes[legKey(l.a, l.b)] = seaRoute(g, lonLatToTile(a.lon, a.lat), lonLatToTile(b.lon, b.lat));
  }
  writeFileSync(OUT, JSON.stringify({ hash, routes }));
  return { routes, fresh: true };
}
