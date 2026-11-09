// Josh's save, 2026-11-09 (Ragnavald, 837): "I still can't take Dyflinn or Mön as my own!" A captain's own raids never
// recorded the place as taken, so no ship-fort could be dug; the Isles opened only in 850; nothing said why.
import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, listActions } from '../../src/engine/index';
import { dayOf } from '../../src/engine/calendar';
import { startBattle, finishBattle } from '../../src/engine/fights';
import { seatOpen, seatStatus } from '../../src/engine/rule';
import { addDeed } from '../../src/engine/fame';
import { startPlunder, plunderAction } from '../../src/engine/plunder';
import { OWN } from '../../src/engine/ownfleet';
import { RngCursor, seedRng } from '../../src/engine/rng';
import type { GameState } from '../../src/engine/state';

function captain(at: string): GameState {
  const s = sandboxGame(12);
  s.day = dayOf(837, 200);
  s.phase = 'sailing';
  s.at = at;
  s.crew.men = 70;
  for (const p of ['dublin', 'man']) if (!s.known.includes(p)) s.known.push(p);
  addDeed(s, content, { type: 'deed', weight: 300 });
  s.deeds.at(-1)!.told = s.day;
  return s;
}

describe('taking a place he raids himself', () => {
  it('a raid he commands and wins marks the place taken, and a ship-fort can be dug', () => {
    const s = captain('dublin');
    startBattle(s, content, { foe: 'rival_crew', men: 20, terrain: 'beach', context: 'raid', place: 'dublin' });
    const b = s.pending!.t === 'battle' ? s.pending.battle : null;
    b!.over = 'won';
    finishBattle(s, content, new RngCursor(seedRng(2)), b!);
    expect(s.places.dublin!.wonOn).toBe(s.day);
  });

  it('his own ship-fort makes Dyflinn Norse, and with it the seat is his to ask for before 845', () => {
    let s = captain('dublin');
    expect(seatStatus(s, content, 'dublin').why.join(' ')).toMatch(/Irish place until the Norse hold it/);
    s.places.dublin!.wonOn = s.day;
    s = act(content, s, { t: 'dig_fort' });
    expect(s.places.dublin!.norse).toBe(true);
    expect(seatOpen(s, content, 'dublin')).toBe(true);
  });

  it('land or a fort on Mön opens the Isles before 850; without it, the reason says so', () => {
    const s = captain('man');
    expect(seatOpen(s, content, 'isles')).toBe(false);
    expect(seatStatus(s, content, 'isles').why.join(' ')).toMatch(/hold land or a ship-fort on Mön/);
    (s.holdings ??= []).push({ place: 'man', kind: 'fort', since: s.day, garrison: 20 });
    expect(seatOpen(s, content, 'isles')).toBe(true);
  });
});

describe('his own fleet strips the town beside him', () => {
  it("the fleet's part comes out of the town, and he keeps a captain's share of it", () => {
    const s = captain('york');
    s.fleet = { id: 'own', since: s.day, own: { ships: 8, men: 240, cohesion: 8, lastAction: s.day } };
    s.places.york!.wealth = 3000;
    startPlunder(s, 'york', [], undefined, content);
    const p = () => (s.pending?.t === 'plunder' ? s.pending.plunder : null)!;
    expect(p().fleetShare).toBeGreaterThan(0.6);
    plunderAction(s, content, new RngCursor(seedRng(5)), 'grab');
    const stripped = 3000 - s.places.york!.wealth;
    expect(p().taken + p().fleetTaken!).toBeCloseTo(stripped, -1);
    const silver = s.silver;
    plunderAction(s, content, new RngCursor(seedRng(6)), 'leave');
    expect(s.silver - silver).toBeGreaterThan(0);
    expect(s.silver - silver).toBeLessThanOrEqual(Math.round((3000 - s.places.york!.wealth) * OWN.leaderShare) + 1);
    void listActions;
  });
});
