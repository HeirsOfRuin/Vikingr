// A fleet of your own (docs/FRAME-FLEETS-REALMS.md, Part C).
import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, listActions } from '../../src/engine/index';
import { dayOf } from '../../src/engine/calendar';
import { arrowShips, ownFleet, ownFleetMen, OWN, tickOwnFleet } from '../../src/engine/ownfleet';
import { fleetYear } from '../../src/engine/sailfleet';
import { startBattle } from '../../src/engine/fights';
import { RngCursor, seedRng } from '../../src/engine/rng';
import type { GameState } from '../../src/engine/state';

function famous(seed = 41): GameState {
  const s = sandboxGame(seed);
  for (let i = 0; i < 10; i++) s.deeds.push({ n: 900 + i, type: 'deed', text: `A great deed ${i}`, weight: 40, witnesses: 2000, day: s.day, place: null, told: s.day, verse: true });
  s.silver = 300;
  s.base.level = 'hall';
  s.ships.push({ id: 'two', type: 'karvi', name: 'the Otter', hull: 90 });
  return s;
}

function withFleet(at = 'lindisfarne'): GameState {
  const s = famous();
  s.at = at;
  s.day = dayOf(850, 150);
  s.phase = 'sailing';
  if (!s.known.includes(at)) s.known.push(at);
  s.fleet = { id: 'own', since: s.day, camp: at, posture: 'lying', moved: s.day, own: { ships: 6, men: 180, cohesion: 6, lastAction: s.day } };
  return s;
}

describe('a fleet of your own', () => {
  it('the war-arrow goes out in winter, and the ships come in the spring', () => {
    let s = famous();
    s.at = 'home_fjord';
    s.day = dayOf(849, 320);
    s.phase = 'winter';
    s.flags._winter = 849;
    s.hallLeft = 2;
    s.pending = null;
    const wa = listActions(s, content).find((o) => o.action.t === 'war_arrow')!;
    expect(wa.enabled).toBe(true);
    s = act(content, s, wa.action);
    expect(s.pending).toEqual({ t: 'scene', id: 'of_arrow' });
    s = act(content, s, { t: 'choose', id: 'any' });
    expect(s.arrow?.year).toBe(850);
    // the spring
    s.day = dayOf(850, 70);
    s.phase = 'muster';
    s.pending = null;
    const ships = arrowShips(s, content);
    s = act(content, s, listActions(s, content).find((o) => o.enabled)!.action);
    for (let i = 0; i < 6 && !ownFleet(s); i++) s = act(content, s, listActions(s, content).find((o) => o.enabled)!.action);
    expect(ownFleet(s)?.ships).toBe(ships);
    expect(s.arrow).toBeUndefined();
  });

  it('its crews stand in his line', () => {
    const s = withFleet();
    startBattle(s, content, { foe: 'northumbrian_levy', men: 100, terrain: 'field', context: 'raid', place: 'lindisfarne' });
    const b = (s.pending as { battle: { us: { men: number }; allyMen?: number } }).battle;
    expect(b.allyMen).toBe(ownFleetMen(s));
    expect(b.us.men).toBeGreaterThan(s.crew.men + 100);
  });

  it('idle weeks wear it down, its captains go home, and it breaks up at the year end', () => {
    const s = withFleet();
    s.fleet!.own!.cohesion = 3;
    s.day += 7 * 12;
    const rng = new RngCursor(seedRng(5));
    const lines = tickOwnFleet(s, content, rng);
    expect(lines.some((l) => /takes his ship home/.test(l))).toBe(true);
    if (s.fleet) {
      expect(s.fleet.own!.ships).toBeLessThan(6);
      expect(fleetYear(s, content)[0]).toMatch(/breaks up/);
      expect(s.fleet).toBeFalsy();
    }
  });

  it('a town can be made to pay, and the leader takes his share', () => {
    let s = withFleet('lindisfarne');
    s.places.lindisfarne!.standing = -4;
    const tr = listActions(s, content).find((o) => o.action.t === 'tribute');
    expect(tr?.enabled).toBe(true);
    const silver = s.silver;
    s = act(content, s, tr!.action);
    expect(s.silver).toBeGreaterThan(silver);
    expect(s.places.lindisfarne!.tributed).toBe(850);
    expect(listActions(s.pending ? act(content, s, { t: 'continue' }) : s, content).find((o) => o.action.t === 'tribute')?.enabled).toBe(false);
  });

  it('a wintering fleet holds through the turn of the year', () => {
    const s = withFleet();
    s.fleet!.own!.winter = true;
    expect(fleetYear(s, content)[0]).toMatch(/wintered with you/);
    expect(ownFleet(s)?.ships).toBe(6);
    expect(OWN.maxShips).toBeGreaterThan(6);
  });
});
