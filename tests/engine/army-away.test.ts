// Playtest 2026-11-07: a captain of the great army sailing off on his own still had the fleet's storms and events.
import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, listActions } from '../../src/engine/index';
import { dayOf } from '../../src/engine/calendar';
import { withFleet } from '../../src/engine/sailfleet';
import { test as cond } from '../../src/engine/conditions';

function captainAtYork() {
  const s = sandboxGame(11);
  s.at = 'york';
  s.known.push('york', 'jarrow', 'lindisfarne', 'whitby', 'sheppey');
  s.day = dayOf(867, 100);
  s.phase = 'sailing';
  s.fleet = { id: 'greatarmy', since: s.day, camp: 'york' };
  return s;
}

describe('a captain of the great army', () => {
  it('sailing away from the camp leaves the army: no fleet events until he comes back', () => {
    let s = captainAtYork();
    expect(withFleet(s)).toBe(true);
    const go = listActions(s, content).find((o) => o.action.t === 'sail' && (o.action as { to: string }).to === 'whitby')!;
    s = act(content, s, go.action);
    expect(s.fleet?.away).toBe(true);
    expect(withFleet(s)).toBe(false);
    expect(cond(['fleet'], s, content)).toBe(false);
    expect(s.journal.some((j) => /on your own account/.test(j.text))).toBe(true);
    // finish whatever the voyage threw up, then sail back
    for (let i = 0; i < 40 && (s.pending || s.at !== 'whitby'); i++) s = act(content, s, listActions(s, content).find((o) => o.enabled)!.action);
    expect(s.at).toBe('whitby');
    {
      const back = listActions(s, content).find((o) => o.action.t === 'sail' && (o.action as { to: string }).to === 'york');
      expect(back?.enabled).toBe(true);
      {
        s = act(content, s, back!.action);
        for (let i = 0; i < 40 && s.at !== 'york'; i++) s = act(content, s, listActions(s, content).find((o) => o.enabled)!.action);
        expect(s.at).toBe('york');
        expect(s.fleet?.away).toBeUndefined();
        expect(s.journal.some((j) => /Rejoined/.test(j.text))).toBe(true);
      }
    }
  });

  it('sailing to the camp, he stays with the army', () => {
    const s = captainAtYork();
    s.fleet!.camp = 'whitby';
    const go = listActions(s, content).find((o) => o.action.t === 'sail' && (o.action as { to: string }).to === 'whitby')!;
    const t = act(content, s, go.action);
    expect(t.fleet?.away).toBeUndefined();
  });

  it('an oarsman is always with the fleet', () => {
    const s = captainAtYork();
    s.fleet!.away = true;
    s.service = { captain: 'Kolr', shipName: 'the Elk', home: 'york', route: [], shares: 1 } as never;
    expect(withFleet(s)).toBe(true);
  });
});
