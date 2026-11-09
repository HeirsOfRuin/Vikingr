// Playtest 2026-11-08: stay with the fleet at a hostile port; sell a ship you don't need.
import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, listActions } from '../../src/engine/index';
import { dayOf } from '../../src/engine/calendar';
import type { GameState } from '../../src/engine/state';

function inCamp(): GameState {
  const s = sandboxGame(61);
  s.at = 'york';
  s.known.push('york');
  s.day = dayOf(867, 140);
  s.phase = 'sailing';
  s.places.york!.standing = -10;
  s.flags.ga_army = 1;
  s.fleet = { id: 'greatarmy', since: dayOf(866, 1), camp: 'york', posture: 'lying', moved: dayOf(866, 300) };
  return s;
}

describe('staying with the fleet', () => {
  it('at a hostile port where the fleet lies, he can stay in its camp', () => {
    let s = inCamp();
    const opts = listActions(s, content);
    expect(opts.some((o) => o.action.t === 'rest')).toBe(false);
    const stay = opts.find((o) => o.action.t === 'fleet_stay')!;
    expect(stay.enabled).toBe(true);
    expect(stay.label).toMatch(/Stay with the great army in camp/);
    const day = s.day;
    const food = s.provisions;
    s = act(content, s, stay.action);
    expect(s.day - day).toBeGreaterThan(0);
    expect(s.day - day).toBeLessThanOrEqual(7);
    expect(s.provisions).toBe(food);
  });

  it('a stay stops on the day the fleet is due to move', () => {
    let s = inCamp();
    s.day = dayOf(867, 272);
    s = act(content, s, listActions(s, content).find((o) => o.action.t === 'fleet_stay')!.action);
    expect(s.day).toBe(dayOf(867, 275));
  });

  it('away from the fleet, or with it bound elsewhere, there is no camp to stay in', () => {
    const s = inCamp();
    s.fleet!.away = true;
    expect(listActions(s, content).some((o) => o.action.t === 'fleet_stay')).toBe(false);
  });
});

describe('selling a ship', () => {
  it('the shipwright buys any ship but his own, and men with no bench stay ashore', () => {
    let s = sandboxGame(62);
    s.at = 'home_fjord';
    s.phase = 'sailing';
    s.ships.push({ id: 'two', type: 'karvi', name: 'the Otter', hull: 80 });
    s.crew.men = 50;
    s.pending = { t: 'shop', shops: ['smith', 'shipwright'] };
    const opts = listActions(s, content);
    expect(opts.find((o) => o.action.t === 'sell_ship' && (o.action as { ship: string }).ship === s.ships[0]!.id)).toBeUndefined();
    const sell = opts.find((o) => o.action.t === 'sell_ship')!;
    expect(sell.label).toBe('Sell the Otter');
    const silver = s.silver;
    s = act(content, s, sell.action);
    expect(s.ships.length).toBe(1);
    expect(s.silver).toBeGreaterThan(silver);
    expect(s.crew.men).toBeLessThanOrEqual(30);
    expect(s.shopNote).toMatch(/no bench now/);
  });
});

describe('choosing the ship he steers', () => {
  it('he takes the new ship; her steersman takes his old one; her fittings go with her', () => {
    let s = sandboxGame(62);
    s.at = 'home_fjord';
    s.phase = 'sailing';
    s.ships.push({ id: 'skeid1', type: 'skeid', name: 'Long Serpent', hull: 100, fittings: ['shield_rack'], master: 'hired:Ljótr' } as GameState['ships'][number]);
    const old = s.ships[0]!.name;
    s = act(content, s, { t: 'take_helm', ship: 'skeid1' });
    expect(s.ships[0]!.name).toBe('Long Serpent');
    expect(s.ships[0]!.master).toBeUndefined();
    expect(s.ships[0]!.fittings).toContain('shield_rack');
    expect(s.ships[1]!.name).toBe(old);
    expect(s.ships[1]!.master).toBe('hired:Ljótr');
    expect(s.journal.at(-1)!.text).toMatch(/Took the steering-oar of Long Serpent; Ljótr has/);
  });
});
