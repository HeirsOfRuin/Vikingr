import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { newGame } from '../../src/engine/index';
import type { GameState } from '../../src/engine/state';
import { applyEffects } from '../../src/engine/effects';
import { shareOut, recruit, recruitable, provisionCost, yearEnd, startWinter } from '../../src/engine/season';
import { alarmRegion, burn, coastMult, coastPlunderStart, hard, loseShip, outshine, payUpkeep, rollHarvest, shiftEnvy, upkeepBill, UPKEEP } from '../../src/engine/hardship';
import { addDeed, livingFame, tellDeeds, RETELL } from '../../src/engine/fame';
import { addWound, ageing, effAttr } from '../../src/engine/hero';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { dayOf } from '../../src/engine/calendar';
import { test as cond } from '../../src/engine/conditions';

const rng = (n = 1) => new RngCursor(seedRng(n));
const captain = (): GameState => {
  const s = sandboxGame(4);
  delete s.flags.owes_jarl;
  s.pending = null;
  s.service = null;
  s.day = dayOf(834, 280);
  s.phase = 'return';
  s.at = 'home_fjord';
  s.ships = [{ id: 'flag', type: 'karvi', name: 'Raven', hull: 100 }];
  s.crew.men = 30;
  s.crew.morale = 6;
  s.silver = 0;
  s.loot = 0;
  for (const m of s.men) { m.alive = true; m.sworn = true; }
  return s;
};

describe('upkeep: the cost of size', () => {
  it('grows with the men, the sworn men, the ships and his name', () => {
    const s = captain();
    const small = upkeepBill(s, content).total;
    s.crew.men = 90;
    s.ships.push({ id: 'b', type: 'snekkja', name: 'Gull', hull: 100 }, { id: 'c', type: 'snekkja', name: 'Hart', hull: 100 });
    const big = upkeepBill(s, content).total;
    expect(big).toBeGreaterThan(small * 2);
    addDeed(s, content, { type: 'deed', text: 'Something great', weight: 120 });
    tellDeeds(s);
    expect(upkeepBill(s, content).men).toBeGreaterThan(Math.round(90 * UPKEEP.crew));
  });

  it('comes off the heap at the share-out, before the men are paid', () => {
    const s = captain();
    s.loot = 1000;
    const bill = upkeepBill(s, content).total;
    shareOut(s, content, 'fair', rng());
    expect(s.hard!.ledger[834]!.upkeep).toBe(bill);
    // the lord's fair share is of what was left
    expect(s.silver).toBe(Math.round((1000 - bill) * 0.3));
  });

  it('unpaid, sends men to other captains and leaves the ships untarred', () => {
    const s = captain();
    s.ships.push({ id: 'b', type: 'karvi', name: 'Gull', hull: 100 });
    s.crew.men = 50;
    const lines = payUpkeep(s, content);
    expect(s.crew.men).toBeLessThan(50);
    expect(s.crew.men).toBeGreaterThanOrEqual(content.ships.karvi!.crew);
    expect(s.ships[1]!.hull).toBe(100 - UPKEEP.unkeptHull);
    expect(s.journal.some((j) => j.text.startsWith('[unpaid]'))).toBe(true);
    expect(lines.length).toBeGreaterThan(1);
  });

  it('is nothing at another man\'s oar', () => {
    const s = captain();
    s.service = { captain: 'Ásgeir', route: [], shares: 1 };
    expect(upkeepBill(s, content).total).toBe(0);
  });
});

describe('envy: the cost of standing out', () => {
  it('is pulled toward how far he outshines the district, and generosity takes it off', () => {
    const s = captain();
    s.silver = 24 * 90;
    s.ships.push({ id: 'b', type: 'karvi', name: 'Gull', hull: 100 }, { id: 'c', type: 'karvi', name: 'Hart', hull: 100 }, { id: 'd', type: 'karvi', name: 'Otter', hull: 100 });
    expect(outshine(s)).toBeGreaterThan(5);
    s.flags._winter = 834;
    s.phase = 'winter';
    yearEnd(s, content, rng(2));
    const after = hard(s).envy;
    expect(after).toBeGreaterThan(2);
    const t = captain();
    t.silver = s.silver; t.ships = s.ships.map((x) => ({ ...x }));
    t.flags._winter = 834; t.phase = 'winter';
    applyEffects(t, content, rng(), [{ give: 'stores' }, { give: 'jarl' }]);
    yearEnd(t, content, rng(2));
    expect(hard(t).envy).toBeLessThan(after);
  });

  it('opens the doors to the challenger, the lawsuit and the jarl', () => {
    const s = captain();
    shiftEnvy(s, 7);
    expect(cond(['envy >= 6'], s, content)).toBe(true);
    for (const id of ['ha_challenger', 'ha_lawsuit', 'ha_farm_raid', 'ha_jarl', 'ha_district']) expect(content.scenes[id]).toBeDefined();
  });
});

describe('disasters', () => {
  it('a bad harvest kills thralls, empties the winter yield and makes spring food dear', () => {
    const s = captain();
    s.base.level = 'farm';
    s.base.thralls = 6;
    const r = { float: () => 0, int: () => 0 } as unknown as RngCursor;
    rollHarvest(s, content, r, 834);
    expect(s.base.thralls).toBe(4);
    expect(s.queue.some((q) => q.scene === 'ha_harvest')).toBe(true);
    s.flags._winter = 834;
    s.phase = 'winter';
    const silver = s.silver;
    yearEnd(s, content, rng(3));
    expect(s.journal.some((j) => /brought in/.test(j.text) && j.day === s.day)).toBe(false);
    expect(s.silver).toBeLessThanOrEqual(silver);
    const dear = provisionCost(s).cost;
    s.hard!.dearth = undefined;
    expect(provisionCost(s).cost).toBeLessThan(dear);
  });

  it('never two bad harvests running', () => {
    const s = captain();
    const r = { float: () => 0, int: () => 0 } as unknown as RngCursor;
    rollHarvest(s, content, r, 834);
    rollHarvest(s, content, r, 835);
    expect(s.hard!.dearth).toBe(834);
  });

  it('fire: what he drags out is saved; a burned hall is a farm, and rebuilds at half price', () => {
    const s = captain();
    s.base = { level: 'hall', thralls: 6, hoard: 400, trophies: ['a', 'b'], wife: null };
    burn(s, content, 'hoard');
    expect(s.base.hoard).toBe(400);
    expect(s.base.trophies).toEqual([]);
    expect(s.base.level).toBe('farm');
    expect(s.flags.hall_burned).toBe(1);
    const t = captain();
    t.base = { level: 'farm', thralls: 6, hoard: 400, trophies: ['a', 'b'], wife: null };
    burn(t, content, 'trophies');
    expect(t.base.hoard).toBe(200);
    expect(t.base.trophies.length).toBe(2);
  });

  it('a storm at anchor takes the worst-kept ship, never the flagship', () => {
    const s = captain();
    s.ships.push({ id: 'b', type: 'karvi', name: 'Gull', hull: 40 }, { id: 'c', type: 'karvi', name: 'Hart', hull: 90 });
    s.crew.men = 90;
    expect(loseShip(s, content, 'wreck')).toBe('Gull');
    expect(s.ships.map((x) => x.name)).toEqual(['Raven', 'Hart']);
    expect(s.crew.men).toBeLessThan(90);
  });

  it('the coast learns: raided regions arm, and say so once', () => {
    const s = captain();
    const before = coastMult(s, content, 'bangor');
    for (let i = 0; i < 6; i++) alarmRegion(s, content, 'bangor', true);
    expect(coastMult(s, content, 'bangor')).toBeGreaterThan(before);
    expect(coastPlunderStart(s, content, 'bangor')).toBeGreaterThan(0);
    expect(s.journal.filter((j) => j.text.startsWith('[coast]')).length).toBe(2);
    // a neighbouring region is not warned
    expect(coastMult(s, content, 'lindisfarne')).toBe(1);
  });
});

describe('the body, and fame', () => {
  it('declines slowly from 32 and faster from 44', () => {
    expect(ageing(30)).toBe(0);
    expect(ageing(40)).toBe(1);
    expect(ageing(52)).toBe(3);
    const s = captain();
    const str = effAttr(s, content, 'str');
    s.day = dayOf(s.hero.born + 1 + 41, 100);
    expect(effAttr(s, content, 'str')).toBeLessThan(str);
  });

  it('a bad wound can leave an old one that never heals', () => {
    const s = captain();
    const r = { float: () => 0, int: () => 0 } as unknown as RngCursor;
    addWound(s, content, 'cracked_ribs', 'a test', r);
    expect(s.hero.wounds.some((w) => w.id === 'old_ribs' && w.until === -1)).toBe(true);
  });

  it('an old deed told again carries less each winter, so fame levels off', () => {
    const s = captain();
    addDeed(s, content, { type: 'deed', text: 'Old news', weight: 10 });
    tellDeeds(s);
    const first = livingFame(s);
    s.day += 400;
    tellDeeds(s);
    expect(livingFame(s)).toBeCloseTo(first * RETELL, 1);
  });
});

describe('the floor: a ruined man can climb back', () => {
  it('men sign on for a promise when he cannot pay the gift', () => {
    const s = captain();
    s.phase = 'muster';
    s.crew.men = 4;
    s.musterPool = 20;
    s.silver = 0;
    expect(recruitable(s, content)).toBeGreaterThan(0);
    recruit(s, content);
    expect(s.crew.men).toBeGreaterThan(4);
    // once a spring
    expect(recruitable(s, content)).toBe(0);
  });

  it('the lean spring: the jarl mans his benches, for a quarter of the heap', () => {
    const s = captain();
    s.crew.men = 4;
    applyEffects(s, content, rng(), [{ jarl_men: true }, { recruit: 18 }]);
    expect(s.crew.men).toBe(22);
    s.loot = 1000;
    shareOut(s, content, 'fair', rng());
    expect(s.journal.some((j) => /steward/.test(j.text)) || s.silver < Math.round((1000 - upkeepBill(s, content).total) * 0.3)).toBe(true);
  });

  it('a winter starting at home can roll the harvest without breaking a service year', () => {
    const s = captain();
    s.service = { captain: 'Ásgeir', route: [], shares: 1 };
    startWinter(s, 5, content, { float: () => 0, int: () => 0 } as unknown as RngCursor);
    expect(s.hard?.dearth).toBeUndefined();
  });
});
