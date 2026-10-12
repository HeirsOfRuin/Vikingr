import { describe, it, expect } from 'vitest';
import { content } from '../helpers';
import { act, listActions, newGame } from '../../src/engine/index';
import type { GameState } from '../../src/engine/state';
import { applyEffects } from '../../src/engine/effects';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { baseStanding, driftStanding, onRaided, standing, tierAt, tierOf } from '../../src/engine/standing';

const rng = () => new RngCursor(seedRng(1));
/** A captain of his own karvi, at anchor at `at`. */
const captainAt = (at: string): GameState => {
  const s = newGame(content, { background: 'freedman', seed: 5, name: 'Ari' });
  s.pending = null;
  s.phase = 'sailing';
  s.day = 150;
  s.at = at;
  s.silver = 500;
  s.provisions = 0;
  return s;
};
const has = (s: GameState, t: string) => listActions(s, content).some((o) => o.action.t === t && o.enabled);
const offered = (s: GameState, t: string) => listActions(s, content).some((o) => o.action.t === t);

describe('standing in the ports', () => {
  it('tiers run from hostile to allied', () => {
    expect([-10, -6, -5, -2, -1, 1, 2, 5, 6, 10].map(tierOf)).toEqual(['hostile', 'hostile', 'unfriendly', 'unfriendly', 'wary', 'wary', 'friendly', 'friendly', 'allied', 'allied']);
  });

  it('every place starts where its people (or its own history) put it', () => {
    const s = captainAt('orkney');
    expect(standing(s, content, 'orkney')).toBe(3);
    expect(standing(s, content, 'conaille')).toBe(-4);
    expect(baseStanding(content, 'dublin')).toBe(-2); // gael
  });

  it('a raid is remembered at the place, and along the coast by its own people, but not by strangers', () => {
    const s = captainAt('bangor');
    onRaided(s, content, 'bangor', { burned: true, captives: true });
    expect(standing(s, content, 'bangor')).toBe(-10); // -3 - 5 - 2 - 1, held at the floor
    expect(standing(s, content, 'conaille')).toBe(-4 - 2 - 1);
    expect(standing(s, content, 'orkney')).toBe(3);
    expect(tierAt(s, content, 'bangor')).toBe('hostile');
  });

  it('a hostile port fights you if you land: no rest, no food, no cattle, no winter; only a fight ashore', () => {
    const s = captainAt('bangor');
    s.places.bangor!.standing = -8;
    expect(offered(s, 'rest')).toBe(false);
    expect(offered(s, 'resupply')).toBe(false);
    expect(offered(s, 'forage')).toBe(false);
    expect(has(s, 'land')).toBe(true);
    const after = act(content, s, { t: 'land' });
    expect(after.pending?.t).toBe('battle');
  });

  it('food is sold at a price set by standing, and not at all where they are unfriendly', () => {
    const s = captainAt('orkney');
    const price = (n: number) => {
      s.places.orkney!.standing = n;
      return listActions(s, content).find((o) => o.action.t === 'resupply');
    };
    expect(price(-3)).toBeUndefined();
    const wary = act(content, (price(0), s), { t: 'resupply' });
    s.places.orkney!.standing = 7;
    const allied = act(content, s, { t: 'resupply' });
    expect(500 - wary.silver).toBeGreaterThan(3 * (500 - allied.silver));
    expect(wary.provisions).toBeGreaterThan(0);
  });

  it('men can be hired at friendly Norse ports, as many as the year allows', () => {
    const s = captainAt('orkney');
    s.crew.men = 4;
    expect(has(s, 'hire')).toBe(true);
    const a = act(content, s, { t: 'hire' });
    expect(a.crew.men).toBe(8);
    expect(has(a, 'hire')).toBe(false); // the friendly pool of four is spent this year
    const irish = captainAt('iona');
    irish.places.iona!.standing = 8;
    expect(offered(irish, 'hire')).toBe(false); // monks do not row
  });

  it('scene effects move standing, and grudges fade a third of the way back each year', () => {
    const s = captainAt('skye');
    applyEffects(s, content, rng(), [{ standing: { place: 'skye', n: 3 } }]);
    expect(standing(s, content, 'skye')).toBe(5);
    s.places.bangor!.standing = -9;
    driftStanding(s, content);
    expect(standing(s, content, 'bangor')).toBe(-7);
    expect(standing(s, content, 'skye')).toBe(4);
  });
});
