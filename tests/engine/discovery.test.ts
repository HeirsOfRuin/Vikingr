import { describe, it, expect } from 'vitest';
import { content } from '../helpers';
import { act, listActions, newGame } from '../../src/engine/index';
import type { GameState } from '../../src/engine/state';
import { hearOfNeighbours, expeditionRoads, routes, runVoyage, startVoyage } from '../../src/engine/voyage';
import { listen } from '../../src/engine/discovery';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { mouths } from '../../src/engine/crew';

const captainAt = (at: string): GameState => {
  const s = newGame(content, { background: 'freedman', seed: 9, name: 'Ari' });
  s.pending = null;
  s.phase = 'sailing';
  s.day = 150;
  s.at = at;
  s.silver = 200;
  return s;
};

describe('discovery', () => {
  it('a new life knows the six places of the first summer', () => {
    expect(newGame(content, { background: 'younger_son', seed: 1, name: 'A' }).known.sort()).toEqual(['bangor', 'home_fjord', 'iona', 'karmoy', 'orkney', 'shetland']);
  });

  it('a friendly port tells of all its neighbours on the first landfall; a hostile one of none; and only once', () => {
    const s = captainAt('orkney');
    expect(hearOfNeighbours(s, content, 'orkney').sort()).toEqual(['lindisfarne', 'skye']);
    expect(hearOfNeighbours(s, content, 'orkney')).toEqual([]);
    const t = captainAt('bangor');
    t.places.bangor!.standing = -8;
    expect(hearOfNeighbours(t, content, 'bangor')).toEqual([]);
    expect(t.known).not.toContain('conaille');
  });

  it('the old sailors can put a far place on the map as a rumour, once a year per port', () => {
    const s = captainAt('shetland');
    s.hero.skills.lore = 10; // sure to hear something true
    const lines = listen(s, content, new RngCursor(seedRng(2)), 'shetland');
    expect(s.rumoured).toContain('faroes');
    expect(lines.join(' ')).toContain('Færeyjar');
    expect(listActions(s, content).some((o) => o.action.t === 'listen')).toBe(false);
  });

  it('a rumoured place has no sea road, only an expedition; arriving charts it and is a deed', () => {
    const s = captainAt('shetland');
    s.rumoured.push('faroes');
    expect(routes(s, content, 'shetland').some((r) => r.to === 'faroes')).toBe(false);
    expect(expeditionRoads(s, content, 'shetland').map((r) => r.to)).toEqual(['faroes']);
    // not enough food: the expedition is offered but barred
    s.provisions = 0;
    expect(listActions(s, content).find((o) => o.action.t === 'expedition')?.enabled).toBe(false);
    s.provisions = mouths(s) * 60;
    startVoyage(s, content, 'faroes', false, true);
    for (let i = 0; i < 50 && s.voyage; i++) {
      runVoyage(s, content, new RngCursor(seedRng(i + 3)));
      s.pending = null; // skip any event or fight for this test
    }
    expect(s.known).toContain('faroes');
    expect(s.rumoured).not.toContain('faroes');
    expect(s.deeds.some((d) => d.text.includes('uncharted'))).toBe(true);
    expect(routes(s, content, 'faroes').some((r) => r.to === 'shetland')).toBe(true);
    void act;
  });
});
