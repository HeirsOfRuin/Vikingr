import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, newGame } from '../../src/engine/index';
import type { BattleState, GameState } from '../../src/engine/state';
import { open, trigger } from '../../src/engine/director';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { dayOf } from '../../src/engine/calendar';
import { favour } from '../../src/engine/allies';

const rng = () => new RngCursor(seedRng(1));
const captain = (year: number, doy = 150): GameState => {
  const s = sandboxGame(4);
  s.pending = null;
  s.service = null;
  s.day = dayOf(year, doy);
  s.phase = 'sailing';
  s.at = 'home_fjord';
  s.ships = [{ id: 'a', type: 'snekkja', name: 'Raven', hull: 100 }];
  s.crew.men = 30;
  s.seen.sp_832 = dayOf(832, 60);
  return s;
};
const choose = (s: GameState, id: string) => { let t = act(content, s, { t: 'choose', id }); if (t.pending?.t === 'report') t = act(content, t, { t: 'continue' }); return t; };

describe('the Frisian Road', () => {
  it('spring 833: the council opens the year', () => {
    const s = captain(833, 60);
    s.phase = 'muster';
    trigger(s, content, rng(), 'phase_start');
    expect(s.pending?.t === 'scene' && s.pending.id).toBe('fr_833');
    const after = choose(s, 'frisia');
    expect(after.known).toContain('dorestad');
  });

  it('Dorestad 834 is a host on the jetties, with Danes on both flanks, and the sack after', () => {
    let s = captain(834, 170);
    s.seen.fr_833 = dayOf(833, 60);
    s.flags.fr_dorestad_sworn = 1;
    s.at = 'dorestad';
    trigger(s, content, rng(), 'arrive');
    expect(s.pending?.t === 'scene' && s.pending.id).toBe('do_fleet');
    s = act(content, s, { t: 'choose', id: 'jetties' });
    const b = (s.pending as { battle: BattleState }).battle;
    expect(b.host!.wings.map((w) => w.name)).toEqual(["Ubbi's Danes", "Horik's hersirs"]);
    expect(b.context).toBe('raid');
    s = act(content, s, { t: 'battle_auto' });
    s = act(content, s, { t: 'fight_end' });
    // won: the sack begins (plunder rounds against the alarm); lost or drawn: the report
    expect(['plunder', 'report']).toContain(s.pending?.t);
  });

  it('Hessel\'s ways make Dorestad easier: fewer awake, a smaller reserve', () => {
    const s = captain(834, 170);
    s.seen.fr_833 = dayOf(833, 60);
    s.flags.fr_dorestad_sworn = 1;
    s.flags.fr_dorestad_ways = 1;
    s.at = 'dorestad';
    open(s, 'do_fleet');
    const t = act(content, s, { t: 'choose', id: 'jetties' });
    const b = (t.pending as { battle: BattleState }).battle;
    expect(b.host!.reserve.them).toBe(15);
    expect(b.them.start).toBe(30);
  });

  it('the jarl dies; who the thing chooses moves the new jarl\'s favour', () => {
    let s = captain(834, 330);
    s.phase = 'winter';
    s.hallLeft = 3;
    s.flags._winter = 834;
    s.seen.fr_833 = dayOf(833, 60);
    s.flags.fr_backs_eirik = 1;
    open(s, 'fr_eystein');
    const f = favour(s);
    s = choose(s, 'eirik');
    expect(s.flags.fr_jarl_eirik).toBe(1);
    expect(favour(s)).toBe(f + 3);
  });

  it('spring 835 closes the chapter and sets the road', () => {
    let s = captain(835, 60);
    s.phase = 'muster';
    s.seen.fr_833 = dayOf(833, 60);
    s.seen.fr_834 = dayOf(834, 60);
    trigger(s, content, rng(), 'phase_start');
    expect(s.pending?.t === 'scene' && s.pending.id).toBe('fr_835');
    s = choose(s, 'frankia');
    expect(s.flags.fr_road_frankia).toBe(1);
  });

  it('regional seas: a ship bound for Frisia meets the flats, not the Irish curraghs', () => {
    const s = captain(834, 170);
    s.voyage = { from: 'ribe', to: 'walcheren', kind: 'coastal', total: 4, progress: 1, daysAtSea: 1, wind: 'fair' };
    s.at = null;
    let flats = 0, pilgrims = 0;
    for (let i = 0; i < 200; i++) {
      const t = structuredClone(s);
      trigger(t, content, new RngCursor(seedRng(i)), 'sea');
      if (t.pending?.t === 'scene' && t.pending.id === 'rg_flats') flats++;
      if (t.pending?.t === 'scene' && t.pending.id === 'rg_pilgrims') pilgrims++;
    }
    expect(flats).toBeGreaterThan(10);
    expect(pilgrims).toBe(0);
  });
});
