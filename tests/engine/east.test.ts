// The East road (docs/FRAME-PLACES-EAST.md, step 2).
import { describe, it, expect } from 'vitest';
import { content } from '../helpers';
import { newGame, act, listActions } from '../../src/engine/index';
import { open } from '../../src/engine/director';
import { dayOf, dateOf } from '../../src/engine/calendar';
import { getValue } from '../../src/engine/paths';
import type { GameState } from '../../src/engine/state';

function atTheDoor(ships = 1, type = 'karvi'): GameState {
  const s = newGame(content, { background: 'younger_son', seed: 7, name: 'Ari', era: 843 });
  s.pending = null; delete (s as Partial<GameState>).service;
  s.ships = Array.from({ length: ships }, (_, i) => ({ id: `s${i}`, type, name: `S${i}`, hull: 90 }));
  s.crew.men = 26; s.at = 'aldeigjuborg'; s.phase = 'sailing'; s.day = dayOf(850, 160); s.fedTo = s.day; s.provisions = 2000; s.silver = 50;
  s.known.push('birka', 'aldeigjuborg');
  open(s, 'ea_door', content);
  return s;
}
const choose = (s: GameState, id: string) => act(content, s, { t: 'choose', id });
const cont = (s: GameState) => (listActions(s, content).some((o) => o.action.t === 'continue') ? act(content, s, { t: 'continue' }) : s);

describe('the East road', () => {
  it('only one light ship can be dragged over the portages', () => {
    expect(getValue(atTheDoor(1, 'karvi'), content, 'ships.portable')).toBe(true);
    expect(getValue(atTheDoor(1, 'snekkja'), content, 'ships.portable')).toBe(false);
    expect(getValue(atTheDoor(2, 'karvi'), content, 'ships.portable')).toBe(false);
    const heavy = atTheDoor(1, 'snekkja');
    expect(listActions(heavy, content).find((o) => o.action.t === 'choose' && (o.action as { id: string }).id === 'volga')?.enabled).toBe(false);
  });

  it('the Volga road runs to a winter at Itil, paid in silver and silk', () => {
    let s = atTheDoor();
    const silver0 = s.silver;
    s = cont(choose(s, 'volga'));
    expect(s.pending).toEqual({ t: 'scene', id: 'ea_v_bulghar' });
    s = cont(choose(s, 'on'));
    s = cont(choose(s, 'pay'));
    s = cont(choose(s, 'honest'));
    expect(s.pending).toEqual({ t: 'scene', id: 'ea_v_back' });
    s = choose(s, 'winter');
    expect(s.flags.ea_far_v).toBe(1);
    expect(s.phase).toBe('winter');
    expect(s.flags._winter).toBe(850);
    expect(s.silver).toBeGreaterThan(silver0 + 400);
    expect(s.cargo?.silk?.lots ?? 0).toBeGreaterThanOrEqual(3);
    expect(dateOf(s.day).year).toBe(850);
  });
});

describe('the closed sea', () => {
  it('from December no ship puts out, and a man can always winter where he is', () => {
    const s = atTheDoor();
    s.pending = null; s.day = dayOf(850, 340); s.at = 'york'; s.places.york!.standing = -8;
    const opts = listActions(s, content);
    expect(opts.filter((o) => o.action.t === 'sail').every((o) => !o.enabled)).toBe(true);
    const w = opts.find((o) => o.action.t === 'winter_here');
    expect(w?.enabled).toBe(true);
    const men = s.crew.men;
    const t = act(content, s, { t: 'winter_here' });
    expect(t.phase).toBe('winter');
    expect(t.crew.men).toBeLessThan(men);
  });
  it('in March the sea is open again', () => {
    const s = atTheDoor();
    s.pending = null; s.day = dayOf(851, 70); s.at = 'birka';
    expect(listActions(s, content).some((o) => o.action.t === 'sail' && o.enabled)).toBe(true);
  });
});
