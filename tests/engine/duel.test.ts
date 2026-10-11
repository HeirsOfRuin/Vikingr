import { describe, it, expect } from 'vitest';
import { content } from '../helpers';
import { DUEL_MOVES } from '../../src/content/schema';
import { BEATS, matchup, makeDuel, sideFromFighter, resolveExchange, fightOut, adaptivePolicy } from '../../src/engine/duel';
import { RngCursor, seedRng } from '../../src/engine/rng';

const duel = () => makeDuel('holmgang', true, 'thorgils', sideFromFighter(content.fighters.eyvind!, 'holmgang'), sideFromFighter(content.fighters.thorgils!, 'holmgang'), 0.1);

describe('duel', () => {
  it('each move beats two and loses to two', () => {
    for (const m of DUEL_MOVES) {
      expect(BEATS[m]).toHaveLength(2);
      expect(DUEL_MOVES.filter((o) => matchup(o, m) > 0)).toHaveLength(2);
      for (const o of DUEL_MOVES) expect(matchup(m, o)).toBe(-matchup(o, m) || 0);
    }
  });
  it('resolves deterministically for a seed', () => {
    const a = resolveExchange(duel(), 'strike', 'feint', new RngCursor(seedRng(3)));
    const b = resolveExchange(duel(), 'strike', 'feint', new RngCursor(seedRng(3)));
    expect(a).toEqual(b);
    expect(a.exchange).toBe(1);
    expect(a.foe.hp).toBeLessThan(a.foe.hpMax);
  });
  it('a duel fought out ends, and somebody bled', () => {
    const rng = new RngCursor(seedRng(4));
    for (let i = 0; i < 50; i++) {
      const d = fightOut(duel(), adaptivePolicy, rng);
      expect(d.over).not.toBeNull();
      expect(d.exchange).toBeGreaterThan(0);
      expect(d.hero.bled || d.foe.bled).toBe(true);
    }
  });
  it('instinct pauses once to offer the yield in a holmgang', () => {
    const rng = new RngCursor(seedRng(8));
    let paused = 0;
    for (let i = 0; i < 100; i++) {
      const d = fightOut(duel(), adaptivePolicy, rng, true);
      if (!d.over) {
        paused++;
        expect(d.paused).toBe(true);
        fightOut(d, adaptivePolicy, rng, true);
        expect(d.over).not.toBeNull();
      }
    }
    expect(paused).toBeGreaterThan(0);
  });
});
