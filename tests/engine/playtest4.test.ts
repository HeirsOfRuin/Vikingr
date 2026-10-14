import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, listActions, newGame } from '../../src/engine/index';
import type { GameState } from '../../src/engine/state';
import { trigger } from '../../src/engine/director';
import { giveItem } from '../../src/engine/items';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { dayOf } from '../../src/engine/calendar';

const rng = () => new RngCursor(seedRng(1));
const captain = (): GameState => {
  const s = sandboxGame(4);
  s.pending = null;
  s.service = null;
  s.day = dayOf(832, 160);
  s.phase = 'sailing';
  s.at = 'kaupang';
  if (!s.known.includes('kaupang')) s.known.push('kaupang');
  s.ships = [{ id: 'a', type: 'karvi', name: 'Gull', hull: 100 }];
  s.crew.men = 24;
  return s;
};

describe('playtest 4', () => {
  it('the heap can be shared out on any strand mid-summer, and the summer goes on', () => {
    let s = captain();
    s.loot = 1500;
    s.silver = 0;
    const morale = s.crew.morale;
    const d = listActions(s, content).find((o) => o.action.t === 'divide' && o.action.how === 'fair');
    expect(d?.enabled).toBe(true);
    s = act(content, s, d!.action);
    expect(s.loot).toBe(0);
    expect(s.silver).toBeGreaterThan(0);
    expect(s.phase).toBe('sailing');
    expect(s.crew.morale).toBeGreaterThanOrEqual(morale);
  });

  it('Ubbi waits for next spring, as he said', () => {
    const s = captain();
    s.flags.ubbi_sworn = 1;
    s.seen.k_ubbi = s.day - 10;
    s.at = 'hedeby';
    trigger(s, content, rng(), 'arrive');
    expect(s.pending?.t === 'scene' && s.pending.id).not.toBe('hd_ubbi');
    const next = captain();
    next.flags.ubbi_sworn = 1;
    next.seen.k_ubbi = dayOf(831, 160);
    next.seen.hd_market = next.day;
    next.at = 'hedeby';
    trigger(next, content, rng(), 'arrive');
    expect(next.pending?.t === 'scene' && next.pending.id).toBe('hd_ubbi');
  });

  it('kit he no longer carries can be sold; an heirloom costs honour', () => {
    let s = captain();
    const sword = giveItem(s, content, 'grandfather_sword');
    giveItem(s, content, 'axe', true);
    s = act(content, s, { t: 'shop' });
    const sell = listActions(s, content).find((o) => o.action.t === 'sell_item' && o.action.uid === sword.uid);
    expect(sell).toBeTruthy();
    const honour = s.honour;
    const silver = s.silver;
    s = act(content, s, sell!.action);
    expect(s.items.some((x) => x.uid === sword.uid)).toBe(false);
    expect(s.silver).toBeGreaterThan(silver);
    expect(s.honour).toBe(Math.max(-10, honour - 1));
  });

  it('or given to a sworn man, who is bound closer and fights better', () => {
    let s = captain();
    const m = s.men[0]!;
    m.alive = true;
    m.sworn = true;
    m.loyalty = 5;
    const w = m.weapons;
    const sword = giveItem(s, content, 'asgeir_sword');
    giveItem(s, content, 'axe', true);
    s = act(content, s, { t: 'give_item', uid: sword.uid, man: m.id });
    expect(s.men[0]!.loyalty).toBe(8);
    expect(s.men[0]!.weapons).toBe(Math.min(6, w + 1));
    expect(s.items.some((x) => x.uid === sword.uid)).toBe(false);
  });
});
