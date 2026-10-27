import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, listActions, newGame } from '../../src/engine/index';
import type { GameState } from '../../src/engine/state';
import { applyEffects } from '../../src/engine/effects';
import { BASE, FARM_PRICE, feastMult, HALL_PRICE, keepCaptives, TROPHY_FEAST_MAX, WIFE_YIELD, winterYield } from '../../src/engine/base';
import { hallAction } from '../../src/engine/season';
import { giveItem } from '../../src/engine/items';
import { addDeed } from '../../src/engine/fame';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { test as cond } from '../../src/engine/conditions';

const rng = () => new RngCursor(seedRng(1));
const winterHome = (): GameState => {
  const s = sandboxGame(4);
  s.pending = null;
  s.service = null;
  s.phase = 'winter';
  s.hallLeft = 3;
  s.day = 300;
  s.at = 'home_fjord';
  s.silver = 2000;
  return s;
};
const hallOpts = (s: GameState) => listActions(s, content).filter((o) => o.action.t === 'hall').map((o) => (o.action as { what: string }).what);

describe('the base', () => {
  it('a new life starts at his father\'s farm, with no hoard, no thralls and no wife', () => {
    const s = newGame(content, { background: 'younger_son', seed: 1, name: 'A' });
    expect(s.base).toEqual({ level: 'father', thralls: 0, hoard: 0, trophies: [], wife: null });
  });

  it('he buys a farm of his own, then builds a hall on it once men know his name', () => {
    const s = winterHome();
    expect(hallOpts(s)).toContain('buy_farm');
    expect(hallOpts(s)).not.toContain('build_hall');
    hallAction(s, content, rng(), 'buy_farm');
    s.pending = null; // a winter scene may follow; not this test's business
    expect(s.base.level).toBe('farm');
    expect(s.silver).toBe(2000 - FARM_PRICE);
    const build = listActions(s, content).find((o) => o.action.t === 'hall' && o.action.what === 'build_hall')!;
    expect(build.enabled).toBe(false); // no name yet
    for (let i = 0; i < 8; i++) addDeed(s, content, { type: 'deed', text: `deed ${i}`, weight: 6, witnesses: 40 });
    for (const d of s.deeds) d.told = s.day;
    const ok = listActions(s, content).find((o) => o.action.t === 'hall' && o.action.what === 'build_hall')!;
    expect(ok.enabled).toBe(true);
    hallAction(s, content, rng(), 'build_hall');
    expect(s.base.level).toBe('hall');
    expect(s.silver).toBe(2000 - FARM_PRICE - HALL_PRICE);
  });

  it('captives kept as thralls fill the room there is, and no more', () => {
    const s = winterHome();
    s.captives = 9;
    expect(keepCaptives(s)).toBe(BASE.father.thralls);
    expect(s.captives).toBe(9 - BASE.father.thralls);
    s.base.level = 'farm';
    expect(keepCaptives(s)).toBe(BASE.farm.thralls - BASE.father.thralls);
  });

  it('the return screen offers to keep captives before they go to the trader', () => {
    const s = winterHome();
    s.phase = 'return';
    s.captives = 3;
    s.base.level = 'farm';
    const k = listActions(s, content).find((o) => o.action.t === 'keep_thralls');
    expect(k?.enabled).toBe(true);
    const after = act(content, s, { t: 'keep_thralls' });
    expect(after.base.thralls).toBe(3);
    expect(after.captives).toBe(0);
  });

  it('thralls and a wife make the place pay over the winter', () => {
    const s = winterHome();
    s.base.level = 'farm';
    s.base.thralls = 4;
    const bare = winterYield(s);
    expect(bare).toBe(4 * BASE.farm.perThrall + BASE.farm.income);
    applyEffects(s, content, rng(), [{ wife: 'Gyða' }]);
    expect(cond('married', s, content)).toBe(true);
    expect(winterYield(s)).toBe(Math.round(bare * WIFE_YIELD));
  });

  it('the base effect only ever moves up', () => {
    const s = winterHome();
    applyEffects(s, content, rng(), [{ base: 'farm' }]);
    expect(s.base.level).toBe('farm');
    applyEffects(s, content, rng(), [{ base: 'father' }]);
    expect(s.base.level).toBe('farm');
  });

  it('the hoard is buried at home and survives a shipwreck; the sea-chest does not', () => {
    let s = winterHome();
    s = act(content, s, { t: 'hoard_in', n: 1000 });
    expect(s.base.hoard).toBe(1000);
    s = act(content, s, { t: 'hoard_in', n: 1000 - 48 }); // all but a pound
    expect(s.silver).toBe(48);
    expect(s.base.hoard).toBe(2000 - 48);
    s = act(content, s, { t: 'hoard_out' });
    expect(s.silver).toBe(2000);
    expect(s.base.hoard).toBe(0);
  });

  it('trophies leave the sea-chest for the wall, and feasts in his own hall tell deeds better', () => {
    const s = winterHome();
    expect(feastMult(s)).toBe(1);
    giveItem(s, content, 'king_horn');
    const hang = listActions(s, content).find((o) => o.action.t === 'hang');
    expect(hang?.enabled).toBe(true);
    const after = act(content, s, { t: 'hang', item: 'king_horn' });
    expect(after.base.trophies).toEqual(['king_horn']);
    expect(after.items.some((x) => x.id === 'king_horn')).toBe(false);
    expect(feastMult(after)).toBe(1); // still his father's farm: nobody's wall but his father's
    after.base.level = 'hall';
    expect(feastMult(after)).toBeCloseTo(1.15 * 1.05);
    after.base.trophies = Array(20).fill('king_horn');
    expect(feastMult(after)).toBeCloseTo(1.15 * (1 + TROPHY_FEAST_MAX));
  });

  it('a hall gives an extra winter action at home, and ten more men at the muster', () => {
    const s = winterHome();
    expect(hallOpts(s)).toContain('feast');
    s.base.level = 'hall';
    expect(BASE.hall.muster).toBe(10);
  });
});

describe('the hall in two winters', () => {
  it('the frame for half, then the roof for the other half', async () => {
    const { sandboxGame, content } = await import('../helpers');
    const { hallAction } = await import('../../src/engine/season');
    const { RngCursor, seedRng } = await import('../../src/engine/rng');
    const { canRaiseFrame, hallPrice, HALL_PRICE } = await import('../../src/engine/base');
    const s = sandboxGame(3);
    s.base.level = 'farm';
    s.silver = HALL_PRICE;
    s.deeds.push({ n: 1, type: 'deed', day: s.day, place: null, text: 'x', weight: 60, witnesses: 0, told: s.day, verse: false });
    expect(canRaiseFrame(s)).toBeNull();
    hallAction(s, content, new RngCursor(seedRng(1)), 'hall_frame');
    // half the price gone (the farm's winter takings may come in on the same action)
    expect(s.silver).toBeLessThan(HALL_PRICE / 2 + 30);
    s.silver = HALL_PRICE / 2;
    expect(hallPrice(s)).toBe(HALL_PRICE / 2);
    hallAction(s, content, new RngCursor(seedRng(1)), 'build_hall');
    expect(s.base.level).toBe('hall');
    expect(s.silver).toBeLessThan(60);
    expect(s.flags.hall_frame).toBeUndefined();
  });
});
