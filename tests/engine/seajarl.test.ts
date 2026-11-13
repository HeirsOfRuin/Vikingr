import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, listActions } from '../../src/engine/index';
import type { GameState } from '../../src/engine/state';
import { dayOf } from '../../src/engine/calendar';
import { fortRisk, holdingAt, holdingYield, LAND } from '../../src/engine/land';
import { networkMuster, SEAJARL, seaJarlStatus, seaJarlYear, seaSkatt, yuleGifts } from '../../src/engine/seajarl';
import { resupplyCost } from '../../src/engine/standing';

// Josh, 2026-11-13: "a way to connect all of your lands and ship forts into a sea-jarl network or something once you
// have a hall and 3 other pieces of land/ship forts".
function landed(seed: number): GameState {
  const s = sandboxGame(seed);
  s.phase = 'sailing'; s.at = 'home_fjord'; s.day = dayOf(840, 150); s.fedTo = s.day;
  s.flags.fr_833_done = 1;
  s.base.level = 'hall';
  s.silver = 1000;
  for (let i = 0; i < 10; i++) s.deeds.push({ n: i + 1, type: 'deed', day: s.day, place: null, text: 'x', weight: 10, witnesses: 100, told: s.day, verse: false });
  s.holdings = [
    { place: 'orkney', kind: 'bought', since: s.day - 800 },
    { place: 'shetland', kind: 'bought', since: s.day - 800 },
    { place: 'bangor', kind: 'fort', since: s.day - 400, garrison: 30 },
  ];
  return s;
}
const sj = (s: GameState) => listActions(s, content).find((o) => o.action.t === 'sea_jarl');

describe('the sea-jarldom', () => {
  it('is offered at home, and says what is missing', () => {
    const s = landed(1);
    s.holdings!.pop();
    expect(sj(s)?.enabled).toBe(false);
    expect(seaJarlStatus(s, content).why.join(' ')).toMatch(/3 places besides your home: you have 2/);
    s.holdings!.push({ place: 'man', kind: 'fort', since: s.day, garrison: 40 });
    s.base.level = 'farm';
    expect(seaJarlStatus(s, content).why.join(' ')).toMatch(/hall of your own/);
    s.base.level = 'hall';
    expect(sj(s)?.enabled).toBe(true);
  });

  it('is named at a feast, and then: one muster, forts together, skatt, free food in his harbours', () => {
    let s = landed(2);
    s.holdings!.push({ place: 'man', kind: 'fort', since: s.day, garrison: 40 });
    const risk0 = fortRisk(s, content, holdingAt(s, 'bangor')!);
    const silver = s.silver;
    s = act(content, s, { t: 'sea_jarl' });
    expect(s.seajarl).toBeTruthy();
    expect(silver - s.silver).toBe(SEAJARL.feast);
    expect(fortRisk(s, content, holdingAt(s, 'bangor')!)).toBeLessThan(risk0);
    expect(networkMuster(s)).toBe(2 * LAND.bought.men + 2 * LAND.fort.men);
    const yields = s.holdings!.reduce((n, h) => n + holdingYield(h), 0);
    expect(seaSkatt(s)).toBe(Math.round(yields * SEAJARL.skatt));
    expect(seaSkatt(s)).toBeGreaterThan(yuleGifts(s));
    s.at = 'orkney'; s.provisions = 0;
    expect(resupplyCost(s, content, 'orkney')!.cost).toBe(0);
    s.pending = null;
    const food = listActions(s, content).find((o) => o.action.t === 'resupply')!;
    expect(food.label).toMatch(/your own people/);
    s.silver = 0;
    s = act(content, s, { t: 'resupply' });
    expect(s.provisions).toBeGreaterThan(0);
  });

  it('pays skatt and gifts at the turn of the year, sends the men, and comes apart below three holdings', () => {
    let s = landed(3);
    s = act(content, s, { t: 'sea_jarl' });
    s.musterPool = 0;
    const before = s.silver;
    const lines = seaJarlYear(s, content).join(' ');
    expect(lines).toMatch(/in skatt at Yule/);
    expect(s.silver - before).toBe(seaSkatt(s) - yuleGifts(s));
    expect(s.musterPool).toBe(networkMuster(s));
    expect(s.holdings!.every((h) => h.mustered === 840)).toBe(true);
    s.holdings!.pop();
    expect(seaJarlYear(s, content).join(' ')).toMatch(/do not come to Yule/);
    expect(s.seajarl).toBeUndefined();
  });
});
