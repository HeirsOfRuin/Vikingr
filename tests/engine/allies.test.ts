import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, listActions, newGame } from '../../src/engine/index';
import type { GameState } from '../../src/engine/state';
import { applyEffects } from '../../src/engine/effects';
import { ALLY, bestAlly, captain, endFelag, favour, favourMuster, FAVOUR, jarlCut, partner, partnerCut, swearFelag } from '../../src/engine/allies';
import { startBattle } from '../../src/engine/fights';
import { hold } from '../../src/engine/fleet';
import { shareOut, JARL_CUT } from '../../src/engine/season';
import { open } from '../../src/engine/director';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { dayOf } from '../../src/engine/calendar';

const rng = () => new RngCursor(seedRng(1));
const captainState = (): GameState => {
  const s = sandboxGame(4);
  s.pending = null;
  s.service = null;
  s.day = dayOf(833, 150);
  s.phase = 'sailing';
  s.at = 'home_fjord';
  s.ships = [{ id: 'a', type: 'karvi', name: 'Gull', hull: 100 }];
  s.crew.men = 24;
  s.silver = 500;
  return s;
};

describe('allies', () => {
  it('what a captain thinks of him starts from what he has heard', () => {
    const s = captainState();
    const before = captain(s, content, 'ubbi').rel;
    s.flags.ubbi_done = 1;
    expect(captain(s, content, 'ubbi').rel).toBe(before + 4);
    s.flags.hrapp_ended = 1;
    expect(captain(s, content, 'onund').rel).toBeLessThan(0);
  });

  it('a félag partner fights beside him, adds his holds, and takes his men\'s share', () => {
    const s = captainState();
    s.captains = { steinarr: { rel: 6, met: true, alive: true } };
    swearFelag(s, content, 'steinarr');
    expect(partner(s, content)).toBe('steinarr');
    expect(hold(s, content)).toBe(1500 + ALLY.holdPerShip);
    startBattle(s, content, { foe: 'rival_crew', men: 20, terrain: 'ship', context: 'sea', place: null });
    const b = s.pending?.t === 'battle' ? s.pending.battle : null;
    expect(b!.us.men).toBeGreaterThanOrEqual(s.crew.men + content.captains.steinarr!.men);
    const cut = partnerCut(s, content, 1000, 24).cut;
    expect(cut).toBe(Math.round((1000 * 32) / (32 + 24)));
  });

  it('a partner who is no friend may hang back', () => {
    let backs = 0;
    for (let d = 0; d < 100; d++) {
      const s = captainState();
      s.day += d;
      s.captains = { steinarr: { rel: 3, met: true, alive: true } };
      swearFelag(s, content, 'steinarr');
      startBattle(s, content, { foe: 'rival_crew', men: 20, terrain: 'ship', context: 'sea', place: null });
      const b = s.pending?.t === 'battle' ? s.pending.battle : null;
      if (!b!.allyMen) backs++;
    }
    expect(backs).toBeGreaterThan(10);
    expect(backs).toBeLessThan(45);
  });

  it('a greedy partner short of friendship takes more than his share', () => {
    const s = captainState();
    s.captains = { sigtrygg: { rel: 3, met: true, alive: true } };
    swearFelag(s, content, 'sigtrygg');
    const fair = Math.round((1000 * 30) / (30 + 24));
    expect(partnerCut(s, content, 1000, 24).cut).toBeGreaterThan(fair);
    expect(captain(s, content, 'sigtrygg').rel).toBe(1);
  });

  it('the félag ends with the summer, better or worse for how it went', () => {
    const s = captainState();
    s.captains = { steinarr: { rel: 5, met: true, alive: true } };
    swearFelag(s, content, 'steinarr');
    s.partner!.loot = 500;
    expect(endFelag(s, content)).toMatch(/part friends/);
    expect(captain(s, content, 'steinarr').rel).toBe(6);
    expect(s.partner).toBeUndefined();
  });

  it('the best ally is the friendliest captain met', () => {
    const s = captainState();
    s.captains = { steinarr: { rel: 4, met: true, alive: true }, ubbi: { rel: 7, met: true, alive: true }, eyvindr: { rel: 9, met: false, alive: true } };
    expect(bestAlly(s, content)).toBe('ubbi');
  });

  it('the jarl\'s favour: gifts raise it; good favour cuts his share and fills the muster', () => {
    let s = captainState();
    s.phase = 'winter';
    s.hallLeft = 3;
    s.at = 'home_fjord';
    const gift = listActions(s, content).find((o) => o.action.t === 'hall' && o.action.what === 'jarl_gift');
    expect(gift?.enabled).toBe(true);
    s = act(content, s, gift!.action);
    expect(favour(s)).toBe(FAVOUR.gift);
    s.favour = 6;
    expect(jarlCut(s, JARL_CUT)).toBeCloseTo(1 / 6);
    expect(favourMuster(s)).toBe(3);
    s.favour = -6;
    expect(favourMuster(s)).toBe(-3);
  });

  it('a partner\'s cut comes off the heap before the jarl\'s', () => {
    const s = captainState();
    s.captains = { steinarr: { rel: 6, met: true, alive: true } };
    swearFelag(s, content, 'steinarr');
    s.loot = 1000;
    s.phase = 'return';
    const lines = shareOut(s, content, 'fair');
    // the winter's keep comes off the top first (docs/FRAME-HARDSHIP.md); then the partner, then the jarl
    const partnerAt = lines.findIndex((l) => /Steinarr takes his men's part/.test(l));
    expect(partnerAt).toBeGreaterThanOrEqual(0);
    const jarlAt = lines.findIndex((l) => /steward takes/.test(l));
    if (jarlAt >= 0) expect(partnerAt).toBeLessThan(jarlAt);
  });

  it('meeting scenes meet; a holmgang can end a feud for good', () => {
    let s = captainState();
    open(s, 'cap_onund');
    s = act(content, s, { t: 'choose', id: 'past' });
    expect(captain(s, content, 'onund').met).toBe(true);
    applyEffects(s, content, rng(), [{ ally: { id: 'onund', kill: true } }]);
    expect(captain(s, content, 'onund').alive).toBe(false);
  });
});
