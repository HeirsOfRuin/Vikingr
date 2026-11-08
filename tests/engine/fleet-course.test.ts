// Fleets that move (docs/FRAME-FLEETS-REALMS.md, Part A): lying and bound, the timetable, following and leaving.
import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, listActions } from '../../src/engine/index';
import { dayOf } from '../../src/engine/calendar';
import { joinFleet, withFleet, courseStage } from '../../src/engine/sailfleet';
import type { GameState } from '../../src/engine/state';

function captain(at: string, year: number, doy: number): GameState {
  const s = sandboxGame(21);
  s.at = at;
  s.day = dayOf(year, doy);
  s.phase = 'sailing';
  for (const p of ['home_fjord', 'ribe', 'walcheren', 'dorestad', 'york', 'whitby', 'jarrow', 'thetford', 'gipeswic', 'nottingham', 'noirmoutier', 'nantes', 'bordeaux']) if (!s.known.includes(p)) s.known.push(p);
  return s;
}
const clear = (s: GameState) => { for (let i = 0; i < 30 && s.pending; i++) s = act(content, s, listActions(s, content).find((o) => o.enabled)!.action); return s; };

describe('a fleet on its course', () => {

  it('the timetable sets the course, and the actions follow it', () => {
    let s = captain('ribe', 834, 155);
    s.fleet = { id: 'danes834', since: dayOf(834, 90), camp: 'ribe', posture: 'lying', moved: dayOf(834, 90) };
    expect(courseStage(s, content)?.at).toBe('dorestad');
    s = act(content, s, { t: 'rest' });
    s = clear(s);
    expect(s.fleet?.camp).toBe('dorestad');
    expect(s.fleet?.posture).toBe('bound');
    const opts = listActions(s, content);
    expect(opts[0]!.action.t).toBe('fleet_follow');
    expect(opts[0]!.label).toMatch(/Sail with the Danish fleet for Dorestad/);
    expect(opts.find((o) => o.action.t === 'sail')?.enabled).toBe(false);
    expect(opts.find((o) => o.action.t === 'fleet_leave')).toBeDefined();
    // follow it all the way
    for (let i = 0; i < 80 && s.at !== 'dorestad'; i++) {
      const o = listActions(s, content);
      const f = o.find((x) => x.action.t === 'fleet_follow' && x.enabled) ?? o.find((x) => x.enabled)!;
      s = act(content, s, f.action);
    }
    expect(s.at).toBe('dorestad');
    expect(s.fleet?.posture).toBe('lying');
    expect(withFleet(s)).toBe(true);
  });

  it('leaving a bound fleet is desertion', () => {
    let s = captain('home_fjord', 834, 115);
    s.fleet = { id: 'danes834', since: dayOf(834, 90), camp: 'dorestad', posture: 'bound', moved: dayOf(834, 110) };
    const h = s.honour;
    s = act(content, s, { t: 'fleet_leave' });
    expect(s.fleet).toBeFalsy();
    expect(s.honour).toBe(h - 2);
    expect(s.journal.at(-1)!.text).toMatch(/Deserted/);
  });

  it('away when the army moves: word comes, and the camp is where the timetable says', () => {
    let s = captain('whitby', 869, 255);
    s.flags.ga_army = 1;
    s.fleet = { id: 'greatarmy', since: dayOf(866, 1), camp: 'york', posture: 'lying', moved: dayOf(868, 250), away: true };
    s.day = dayOf(869, 262);
    s = act(content, s, { t: 'rest' });
    expect(s.fleet?.camp).toBe('thetford');
    expect(s.pending?.t === 'report' && s.pending.title).toBe('Word of the fleet');
    expect(s.journal.some((j) => /moved to Þjóðford while you were away/.test(j.text))).toBe(true);
  });

  it('a scene that moved the army ahead of the timetable is not undone by it', () => {
    let s = captain('nottingham', 867, 290);
    s.flags.ga_army = 1;
    s.fleet = { id: 'greatarmy', since: dayOf(866, 1), camp: 'nottingham', posture: 'lying', moved: dayOf(867, 59) };
    s = act(content, s, { t: 'rest' });
    expect(s.fleet?.camp).toBe('nottingham');
    expect(s.fleet?.posture).toBe('lying');
  });

  it('the siege of Bordeaux lies: he may go off and come back', () => {
    let s = captain('bordeaux', 847, 200);
    s.flags.bx_sworn = 1;
    s.fleet = { id: 'loire847', since: dayOf(847, 120), camp: 'bordeaux', posture: 'lying', moved: dayOf(847, 190) };
    const go = listActions(s, content).find((o) => o.action.t === 'sail' && o.enabled);
    expect(go).toBeDefined();
    s = act(content, s, go!.action);
    expect(s.fleet?.away).toBe(true);
    expect(withFleet(s)).toBe(false);
  });
});
