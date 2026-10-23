import { describe, it, expect } from 'vitest';
import { alongPath, seaGrid, seaRoute, SEAWAY } from '../../src/engine/seaway';
import { encodeRle, TERRAIN, type MapData } from '../../src/engine/mapgrid';
import routes from '../../src/content/routes.json';
import { content } from '../helpers';

// a 20x10 sea with a wall of land down the middle, open only at the bottom row
const SEA = TERRAIN.indexOf('sea'), FARM = TERRAIN.indexOf('farm');
const toy = (): MapData => {
  const t = new Uint8Array(20 * 10).fill(SEA);
  for (let y = 0; y < 9; y++) t[y * 20 + 10] = FARM;
  return { cols: 20, rows: 10, terrain: [...TERRAIN], rle: encodeRle(t), rivers: [] };
};

describe('sea routes', () => {
  it('goes round the land, not across it', () => {
    const g = seaGrid(toy());
    const p = seaRoute(g, [5.5, 1.5], [15.5, 1.5]);
    let deepest = 0;
    for (let i = 1; i < p.length; i += 2) deepest = Math.max(deepest, p[i]!);
    expect(deepest).toBeGreaterThan(8.5);
    for (let i = 0; i < p.length; i += 2) expect(g.cost[Math.floor(p[i + 1]!) * 20 + Math.floor(p[i]!)]).toBeLessThan(SEAWAY.land);
  });

  it('a point along the path moves from one end to the other', () => {
    const p = [0, 0, 10, 0, 10, 10];
    expect(alongPath(p, 0)).toEqual([0, 0]);
    expect(alongPath(p, 0.5)).toEqual([10, 0]);
    expect(alongPath(p, 1)).toEqual([10, 10]);
  });

  it('every leg has a route, built from the current content', () => {
    const r = (routes as { routes: Record<string, number[]> }).routes;
    for (const l of content.legs) expect(r[`${l.a}|${l.b}`]?.length).toBeGreaterThanOrEqual(4);
  });
});
