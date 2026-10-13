import { describe, it, expect } from 'vitest';
import { content } from '../helpers';
import { act, listActions, newGame } from '../../src/engine/index';
import type { GameState } from '../../src/engine/state';
import { creditWeapon, equipped, giveItem, heroArmour, heroWeapon, NAME_AT, GEAR_QUALITY } from '../../src/engine/items';
import { addDeed } from '../../src/engine/fame';
import { startBattle } from '../../src/engine/fights';
import { fleetSpeed } from '../../src/engine/crew';
import { RngCursor, seedRng } from '../../src/engine/rng';

const captainHome = (): GameState => {
  const s = newGame(content, { background: 'freedman', seed: 4, name: 'Ari' });
  s.pending = null;
  s.phase = 'sailing';
  s.day = 150;
  s.at = 'home_fjord';
  s.silver = 1000;
  return s;
};

describe('kit, ship and the men', () => {
  it('a new life carries a spear, a shield and a leather jerkin', () => {
    const s = newGame(content, { background: 'younger_son', seed: 1, name: 'A' });
    expect(equipped(s, 'weapon')?.id).toBe('spear');
    expect(equipped(s, 'shield')?.id).toBe('shield');
    expect(heroWeapon(s, content)).toBe(2);
    expect(heroArmour(s, content)).toBe(1);
  });

  it('the smith and shipwright at home sell kit and fittings; bought kit is carried, fittings go on the ship', () => {
    let s = captainHome();
    s = act(content, s, { t: 'shop' });
    expect(s.pending?.t).toBe('shop');
    const items = listActions(s, content).filter((o) => o.action.t === 'buy').map((o) => (o.action as { item: string }).item);
    expect(items).toContain('helmet');
    expect(items).toContain('caulking');
    expect(items).not.toContain('mail'); // a market thing, not the home smith's
    s = act(content, s, { t: 'buy', item: 'helmet' });
    expect(heroArmour(s, content)).toBe(2);
    const speed = fleetSpeed(s, content);
    s = act(content, s, { t: 'buy', item: 'new_sail' });
    expect(fleetSpeed(s, content)).toBeCloseTo(speed * 1.1, 5);
  });

  it("arming the men raises their gear a level, and the gear counts in the wall", () => {
    let s = captainHome();
    s = act(content, s, { t: 'shop' });
    s = act(content, s, { t: 'arm' });
    expect(s.crew.gear).toBe(1);
    s.pending = null;
    startBattle(s, content, { foe: 'island_men', men: 10, terrain: 'beach', context: 'scene', place: 'home_fjord' });
    const p = s.pending as { t: string; battle?: { us: { quality: number } } } | null;
    expect(p?.battle?.us.quality).toBeCloseTo(s.crew.quality + GEAR_QUALITY, 5);
  });

  it('a weapon with enough deeds is given a name, and named, it makes fighting deeds weigh more', () => {
    const s = captainHome();
    giveItem(s, content, 'grandfather_sword', true);
    const rng = new RngCursor(seedRng(3));
    const plain = addDeed(s, content, { type: 'duel_won', text: 'x', witnesses: 10 }).weight;
    let line: string | null = null;
    for (let i = 0; i < NAME_AT && !line; i++) line = creditWeapon(s, content, rng, 1);
    expect(line).not.toBeNull();
    expect(equipped(s, 'weapon')?.name).toBeTruthy();
    expect(s.deeds.some((d) => d.type === 'weapon_named')).toBe(true);
    const named = addDeed(s, content, { type: 'duel_won', text: 'y', witnesses: 10 }).weight;
    expect(named).toBeGreaterThan(plain);
  });

  it('old saves get their kit back from the flags that used to stand for it', async () => {
    const { fromSave, toSave } = await import('../../src/engine/save');
    const s = captainHome();
    s.flags.b_sword = 1;
    const raw = JSON.parse(JSON.stringify(toSave(s, content)));
    delete raw.state.items;
    delete raw.state.kit;
    delete raw.state.crew.gear;
    const loaded = fromSave(raw, content).state;
    expect(equipped(loaded, 'weapon')?.id).toBe('grandfather_sword');
    expect(loaded.crew.gear).toBe(0);
  });
});
