import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, listActions, newGame } from '../../src/engine/index';
import type { GameState } from '../../src/engine/state';
import { applyEffects } from '../../src/engine/effects';
import { RING, ringsOf } from '../../src/engine/rings';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { dayOf } from '../../src/engine/calendar';
import { test as cond } from '../../src/engine/conditions';

const rng = () => new RngCursor(seedRng(1));
const winter = (): GameState => {
  const s = sandboxGame(4);
  s.pending = null;
  s.service = null;
  s.day = dayOf(833, 320);
  s.flags._winter = 833;
  s.phase = 'winter';
  s.hallLeft = 5;
  s.at = 'home_fjord';
  s.ships = [{ id: 'flag', type: 'karvi', name: 'Raven', hull: 100 }];
  s.crew.men = 26;
  s.silver = 200;
  for (const m of s.men) { m.alive = true; m.sworn = true; m.loyalty = 3; }
  return s;
};
const gifts = (s: GameState) => listActions(s, content).filter((o) => o.action.t === 'hall' && (o.action.what === 'gift' || o.action.what === 'gift_gold'));

describe('arm-rings', () => {
  it('cannot be given until he holds one', () => {
    const s = winter();
    expect(gifts(s).every((o) => !o.enabled)).toBe(true);
  });

  it('the smith makes a silver one out of his silver, and then it can be given', () => {
    let s = winter();
    s = act(content, s, { t: 'make_ring' });
    expect(ringsOf(s).silver).toBe(1);
    expect(s.silver).toBe(200 - RING.silver.make);
    s.pending = null;
    const m = s.men[0]!;
    s = act(content, s, { t: 'hall', what: 'gift', arg: m.id });
    expect(ringsOf(s).silver).toBe(0);
    expect(s.men[0]!.loyalty).toBe(3 + RING.silver.loyalty);
  });

  it('gold comes only from a lord or plunder, and is worth more given', () => {
    let s = winter();
    expect(gifts(s).some((o) => o.action.t === 'hall' && o.action.what === 'gift_gold')).toBe(false);
    applyEffects(s, content, rng(), [{ ring: { metal: 'gold' } }]);
    expect(cond(['rings.gold >= 1'], s, content)).toBe(true);
    const m = s.men[0]!;
    s = act(content, s, { t: 'hall', what: 'gift_gold', arg: m.id });
    expect(s.men[0]!.loyalty).toBe(3 + RING.gold.loyalty);
    expect(s.deeds.some((d) => /gold arm-ring/.test(d.text))).toBe(true);
  });

  it('cut up, a ring is hacksilver by weight', () => {
    let s = winter();
    applyEffects(s, content, rng(), [{ ring: { metal: 'gold' } }]);
    s = act(content, s, { t: 'cut_ring', metal: 'gold' });
    expect(s.silver).toBe(200 + RING.gold.weight);
    expect(ringsOf(s).gold).toBe(0);
  });

  it('a gold ring to the jarl is twice any other gift', () => {
    let s = winter();
    applyEffects(s, content, rng(), [{ ring: { metal: 'gold' } }]);
    const before = s.favour ?? 0;
    s = act(content, s, { t: 'hall', what: 'jarl_gift', arg: 'gold' });
    expect((s.favour ?? 0) - before).toBe(4);
  });
});
