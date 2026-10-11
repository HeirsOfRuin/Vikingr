import { describe, it, expect } from 'vitest';
import { content, map } from '../helpers';
import { validate } from '../../tools/validate-lib';
import { decodeRle, MAP_GRID, terrainAt, lonLatToTile } from '../../src/engine/mapgrid';

describe('content', () => {
  it('validates clean', () => {
    expect(validate(content, map).errors).toEqual([]);
  });
  it('the validator catches what it claims to catch', () => {
    const broken = structuredClone(content);
    const s = broken.scenes.p1_sea_rivals!;
    s.choices[0]!.danger = undefined;
    s.choices[0]!.next = 'no_such_scene';
    broken.places.bangor!.lon = 0; // the middle of the North Sea
    broken.places.bangor!.lat = 57;
    const errs = validate(broken, map).errors.join('\n');
    expect(errs).toMatch(/not marked danger/);
    expect(errs).toMatch(/no scene "no_such_scene"/);
    expect(errs).toMatch(/place bangor: .* open water/);
  });
});

describe('map', () => {
  it('decodes to the full grid', () => {
    expect(decodeRle(map.rle, map.cols * map.rows)).toHaveLength(MAP_GRID.cols * MAP_GRID.rows);
  });
  it('knows land from sea', () => {
    const at = (lon: number, lat: number) => terrainAt(map, ...lonLatToTile(lon, lat));
    expect(['deep', 'sea']).toContain(at(2, 57)); // the North Sea
    expect(['deep', 'sea']).toContain(at(-12, 60)); // the Atlantic
    expect(['farm', 'forest', 'moor', 'marsh']).toContain(at(9.2, 56)); // Jutland
    expect(at(31.5, 60.8)).toBe('lake'); // Ladoga
  });
});
