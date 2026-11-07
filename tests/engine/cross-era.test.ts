// Later stories from earlier lives (Josh, 2026-11-07): a captain from an 830 or 843 start can join the great army, and
// the Loire years are open to any life that is on the Loire.
import { describe, it, expect } from 'vitest';
import { content } from '../helpers';
import { newGame, act, listActions } from '../../src/engine/index';
import { dayOf } from '../../src/engine/calendar';
import { renderText } from '../../src/engine/text';
import { fleetBound } from '../../src/engine/sailfleet';
import { trigger } from '../../src/engine/director';
import { RngCursor, seedRng } from '../../src/engine/rng';
import type { GameState } from '../../src/engine/state';

function captain843(at: string, year: number, doy: number): GameState {
  const s = newGame(content, { background: 'younger_son', seed: 51, name: 'Ari', era: 843 });
  s.pending = null;
  s.service = null;
  delete s.fleet;
  s.ships = [{ id: 'one', type: 'karvi', name: 'the Hart', hull: 90 }];
  s.crew.men = 28;
  s.at = at;
  s.day = dayOf(year, doy);
  s.phase = 'sailing';
  for (const p of [at, 'gipeswic', 'sheppey', 'walcheren', 'ribe']) if (!s.known.includes(p)) s.known.push(p);
  return s;
}

describe('later stories from earlier lives', () => {
  it('an 843 captain meets the army\'s men at Hedeby in 866, joins, and is bound for its camp', () => {
    let s = captain843('hedeby', 866, 120);
    s = act(content, s, { t: 'rest' });
    for (let i = 0; i < 8 && !(s.pending?.t === 'scene' && s.pending.id === 'ga_join_recruit'); i++) s = act(content, s, listActions(s, content).find((o) => o.enabled)!.action);
    expect(s.pending).toEqual({ t: 'scene', id: 'ga_join_recruit' });
    s = act(content, s, { t: 'choose', id: 'go' });
    expect(s.flags.ga_army).toBe(1);
    expect(s.fleet?.id).toBe('greatarmy');
    expect(s.fleet?.camp).toBe('gipeswic');
    for (let i = 0; i < 6 && s.pending; i++) s = act(content, s, listActions(s, content).find((o) => o.enabled)!.action);
    expect(fleetBound(s)).toBe('gipeswic');
    expect(listActions(s, content)[0]!.action.t).toBe('fleet_follow');
  });

  it('in 865 the sons of Ragnarr call him, and he sails for East Anglia', () => {
    let s = captain843('home_fjord', 865, 100);
    s.phase = 'muster';
    for (const id of Object.keys(content.scenes)) if (id !== 'ga_join_865' && content.scenes[id]!.trigger === 'phase_start') s.seen[id] = s.day;
    trigger(s, content, new RngCursor(seedRng(3)), 'phase_start');
    expect(s.pending).toEqual({ t: 'scene', id: 'ga_join_865' });
    s = act(content, s, { t: 'choose', id: 'go' });
    expect(s.fleet?.camp).toBe('gipeswic');
    expect(s.fleet?.posture).toBe('bound');
  });

  it('the Loire years are not locked to the 843 start', () => {
    for (const id of ['v43_danes', 'v43_ribe', 'y45_flux', 'y46_winter', 'y47_meersen', 'y47_boy', 'y48_ireland', 'y45_island_attack', 'y46_poitou']) {
      expect(JSON.stringify(content.scenes[id]!.requires ?? [])).not.toMatch(/era843/);
    }
    const s = captain843('noirmoutier', 847, 330);
    delete s.flags.era843;
    expect(renderText(content.scenes.y47_boy!.text, s, content)).toMatch(/You were his age yourself/);
  });
});
