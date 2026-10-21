import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, listActions } from '../../src/engine/index';
import type { BattleState, GameState } from '../../src/engine/state';
import { dayOf } from '../../src/engine/calendar';
import { pastChronicle } from '../../src/engine/chronicle';
import { startBattle } from '../../src/engine/fights';
import { coursePath } from '../../src/engine/course';
import { forecast, runCruise, startCruise } from '../../src/engine/cruise';
import { hpMax } from '../../src/engine/hero';
import { RngCursor, seedRng } from '../../src/engine/rng';

// docs/FRAME-PACING.md: the end of a fight, a course, a coast on standing orders.
function captain(seed: number, at = 'home_fjord'): GameState {
  const s = sandboxGame(seed);
  s.day = dayOf(836, 140); s.at = at; s.phase = 'sailing'; s.fedTo = s.day;
  s.ships = [{ id: 'a', type: 'snekkja', name: 'Raven', hull: 95 }, { id: 'b', type: 'karvi', name: 'Wolf', hull: 95 }];
  s.crew.men = 60; s.provisions = 3000; s.silver = 300;
  for (const p of ['iona', 'bangor', 'conaille', 'dublin', 'armagh', 'rechru', 'linn_duachaill', 'glendalough', 'skye', 'orkney', 'man', 'lindisfarne']) if (!s.known.includes(p)) s.known.push(p);
  s.chron = pastChronicle(s, content);
  return s;
}

describe('the end of a fight is seen before the aftermath (playtest 6)', () => {
  it('the field stays on screen when the last blow lands; Continue goes on to the plunder or the report', () => {
    let s = captain(1, 'lindisfarne');
    startBattle(s, content, { foe: 'monks_tenants', men: 6, terrain: 'beach', context: 'raid', place: 'lindisfarne' });
    s = act(content, s, { t: 'battle_auto' });
    const b = (s.pending as { t: 'battle'; battle: BattleState }).battle;
    expect(s.pending?.t).toBe('battle');
    expect(b.over).toBeTruthy();
    const opts = listActions(s, content);
    expect(opts.map((o) => o.action.t)).toEqual(['fight_end']);
    s = act(content, s, { t: 'fight_end' });
    expect(['plunder', 'report']).toContain(s.pending?.t);
  });
});

describe('a course for a far port', () => {
  it('goes by the shortest known road, leg by leg, and is offered again if something breaks in', () => {
    let s = captain(2);
    const c = coursePath(s, content, 'home_fjord', 'dublin')!;
    expect(c.path.length).toBeGreaterThan(1);
    expect(c.path.at(-1)).toBe('dublin');
    s = act(content, s, { t: 'course', to: 'dublin' });
    let g = 0;
    while (s.at !== 'dublin' && !s.death && g++ < 40) {
      const opts = listActions(s, content).filter((o) => o.enabled);
      // whatever broke in is dealt with; then the course is held
      const hold = !s.pending && !s.voyage ? opts.find((o) => o.action.t === 'course' && (o.action as { to: string }).to === 'dublin') : undefined;
      if (!s.pending && !s.voyage) expect(hold).toBeTruthy();
      const next = opts.find((o) => ['continue', 'voyage_on', 'fight_end', 'battle_auto', 'duel_auto'].includes(o.action.t)) ?? opts.find((o) => o.action.t === 'plunder' && (o.action as { what: string }).what === 'leave') ?? opts[0];
      s = act(content, s, (hold ?? next)!.action);
    }
    expect(s.death || s.at === 'dublin').toBeTruthy();
  });
});

describe('a-viking along a coast on standing orders', () => {
  it('the orders screen offers the coasts he knows, and the men\'s reckoning from the same engine', () => {
    let s = captain(3);
    s = act(content, s, { t: 'cruise_plan' });
    const opts = listActions(s, content);
    expect(opts.some((o) => o.label.includes('The coast of Ireland'))).toBe(true);
    const go = opts.find((o) => o.action.t === 'cruise_go')!;
    expect(go.hint).toMatch(/reckoning/);
    // the same summer, reckoned twice, is the same reckoning
    expect(forecast(s, content, s.cruisePlan!)).toEqual(forecast(structuredClone(s), content, s.cruisePlan!));
  });

  it('raids by the orders and stops for him when he is badly hurt', () => {
    const s = captain(4, 'dublin');
    startCruise(s, content, { coast: 'ireland', days: 30, aim: 'balance', bold: 'bold', lead: 'none', then: 'stay' });
    s.hero.hp = Math.floor(hpMax(s, content) * 0.3);
    const lines = runCruise(s, content, new RngCursor(seedRng(4)));
    expect(s.cruise).toBeUndefined();
    expect(lines.join(' ')).toMatch(/hurt badly/);
  });

  it('a fight he said he would lead stops the cruise on the battle screen; the men fight the rest', () => {
    const s = captain(5, 'dublin');
    s.places.dublin!.norse = false;
    startCruise(s, content, { coast: 'ireland', days: 30, aim: 'silver', bold: 'bold', lead: 'all', then: 'stay' });
    runCruise(s, content, new RngCursor(seedRng(5)));
    expect(s.pending?.t === 'battle' || s.pending?.t === 'scene').toBe(true);
    expect(s.cruise).toBeTruthy();
  });
});
