import { describe, it, expect } from 'vitest';
import { RngCursor, seedRng, rngNext } from '../../src/engine/rng';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = new RngCursor(seedRng(5));
    const b = new RngCursor(seedRng(5));
    for (let i = 0; i < 50; i++) expect(a.float()).toBe(b.float());
  });
  it('differs between seeds and stays in [0,1)', () => {
    const a = new RngCursor(seedRng(1));
    const b = new RngCursor(seedRng(2));
    let same = 0;
    for (let i = 0; i < 100; i++) {
      const x = a.float();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      if (x === b.float()) same++;
    }
    expect(same).toBeLessThan(3);
  });
  it('is pure', () => {
    const s = seedRng(9);
    expect(rngNext(s)[0]).toBe(rngNext(s)[0]);
  });
});
