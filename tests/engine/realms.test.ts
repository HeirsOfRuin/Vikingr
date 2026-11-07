// A realm of your own (docs/FRAME-FLEETS-REALMS.md, Part B): the new seats, and a holding raised into a lordship.
import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, listActions } from '../../src/engine/index';
import { dayOf } from '../../src/engine/calendar';
import { seatOpen, claim, ruleTitle, ruleYear, ruleTribute, SEAT_EVENTS } from '../../src/engine/rule';
import { livingFame } from '../../src/engine/fame';
import { RngCursor, seedRng } from '../../src/engine/rng';
import type { GameState } from '../../src/engine/state';

function famous(at: string, year: number): GameState {
  const s = sandboxGame(31);
  s.at = at;
  s.day = dayOf(year, 150);
  s.phase = 'sailing';
  s.silver = 600;
  for (const p of [at, 'york', 'jarrow']) if (!s.known.includes(p)) s.known.push(p);
  for (let i = 0; i < 6; i++) s.deeds.push({ n: 900 + i, type: 'deed', text: `A great deed ${i}`, weight: 40, witnesses: 2000, day: s.day - 10, place: null, told: s.day - 10, verse: true });
  return s;
}

describe('a realm of your own', () => {
  it('a captain of the army may claim Jórvík, and be its king', () => {
    let s = famous('whitby', 870);
    s.flags.ga_army = 1;
    expect(livingFame(s)).toBeGreaterThan(160);
    expect(seatOpen(s, content, 'york')).toBe(true);
    expect(claim(s, content, 'york')).toBeGreaterThan(0);
    const go = listActions(s, content).find((o) => o.action.t === 'sail' && (o.action as { to: string }).to === 'york')!;
    s = act(content, s, go.action);
    for (let i = 0; i < 40 && !(s.pending?.t === 'scene' && s.pending.id === 'ru_york'); i++) s = act(content, s, listActions(s, content).find((o) => o.enabled)!.action);
    expect(s.pending).toEqual({ t: 'scene', id: 'ru_york' });
    s = act(content, s, { t: 'choose', id: 'silver' });
    expect(s.rule?.seat).toBe('york');
    expect(ruleTitle(s)).toBe('king in Jórvík');
  });

  it('a holding kept three winters can be raised into a lordship', () => {
    let s = famous('jarrow', 872);
    s.holdings = [{ place: 'jarrow', kind: 'fort', since: dayOf(868, 200), garrison: 10 }];
    expect(seatOpen(s, content, 'lordship')).toBe(true);
    s = act(content, s, { t: 'rest' });
    for (let i = 0; i < 10 && !(s.pending?.t === 'scene' && s.pending.id === 'ru_lordship'); i++) s = act(content, s, listActions(s, content).find((o) => o.enabled)!.action);
    expect(s.pending).toEqual({ t: 'scene', id: 'ru_lordship' });
    s = act(content, s, { t: 'choose', id: 'lord' });
    expect(s.rule?.seat).toBe('lordship');
    expect(s.rule?.place).toBe('jarrow');
    expect(ruleTitle(s)).toBe('lord of Jarrow');
    expect(ruleTribute(s).silver).toBe(60);
    // the turn of the year brings the lordship's own troubles
    const lines = ruleYear(s, content, new RngCursor(seedRng(2)), 'jarrow');
    expect(lines[0]).toMatch(/As lord of Jarrow, your tribute comes in/);
  });

  it('every seat event is a scene', () => {
    for (const ids of Object.values(SEAT_EVENTS)) for (const id of ids!) expect(content.scenes[id], id).toBeDefined();
  });
});
