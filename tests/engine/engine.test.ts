import { describe, it, expect } from 'vitest';
import { content } from '../helpers';
import { act, newGame, listActions, screenOf, ActionError, type Action } from '../../src/engine/index';
import { dateOf } from '../../src/engine/calendar';
import type { GameState } from '../../src/engine/state';
import { toSave, fromSave } from '../../src/engine/save';
import { encodeSaveCode, decodeSaveCode } from '../../src/engine/savecode';
import { livingFame } from '../../src/engine/fame';
import { playLife } from '../../tools/bot-lib';

const start = () => newGame(content, { background: 'younger_son', seed: 7, name: 'Ari' });
/** The Phase 1 sandbox: a placeholder start with a borrowed karvi (the outlaw and the freedman's son, until Phase 3). */
const sandbox = () => newGame(content, { background: 'freedman', seed: 7, name: 'Ari' });
const doFirst = (s: GameState, pred: (a: Action) => boolean) => {
  const o = listActions(s, content).find((x) => x.enabled && pred(x.action));
  if (!o) throw new Error(`no enabled action on ${screenOf(s)}: ${listActions(s, content).map((x) => JSON.stringify(x.action)).join(' ')}`);
  return act(content, s, o.action);
};
/** Plays through scenes, reports and any fight they start. */
const clear = (s: GameState) => {
  for (;;) {
    const sc = screenOf(s);
    if (sc === 'scene' || sc === 'report') s = doFirst(s, () => true);
    else if (sc === 'duel') s = doFirst(s, (a) => a.t === 'duel_auto' || a.t === 'yield');
    else if (sc === 'battle') s = doFirst(s, (a) => a.t === 'battle_auto');
    else return s;
  }
};

describe('engine', () => {
  it('starts at the spring muster of 830 with the start scene open', () => {
    const s = start();
    expect(dateOf(s.day)).toMatchObject({ year: 830, month: 2 });
    expect(screenOf(s)).toBe('scene');
    expect(s.hero.name).toBe('Ari Hallsson');
    expect(s.men).toHaveLength(4);
  });
  it('act is pure: it never changes its input', () => {
    const s = start();
    const copy = structuredClone(s);
    act(content, s, listActions(s, content)[0]!.action);
    expect(s).toEqual(copy);
  });
  it('refuses actions that are not available', () => {
    expect(() => act(content, start(), { t: 'raid' })).toThrow(ActionError);
  });
  it('musters, sails and arrives', () => {
    let s = clear(sandbox());
    expect(screenOf(s)).toBe('muster');
    s = clear(doFirst(s, (a) => a.t === 'recruit'));
    s = clear(doFirst(s, (a) => a.t === 'set_sail'));
    expect(screenOf(s)).toBe('place');
    const day = s.day;
    s = doFirst(s, (a) => a.t === 'sail' && a.to === 'shetland');
    s = clear(s);
    while (screenOf(s) === 'voyage' || screenOf(s) === 'battle') s = clear(doFirst(s, (a) => a.t === 'voyage_on' || a.t === 'battle_auto'));
    expect(s.day).toBeGreaterThan(day);
    if (s.hero.alive) expect(s.at).toBe('shetland');
  });
  it('a winter in the hall ends in the next spring', () => {
    let s = clear(sandbox());
    s = clear(doFirst(s, (a) => a.t === 'stay_home'));
    expect(screenOf(s)).toBe('return');
    s = clear(doFirst(s, (a) => a.t === 'share'));
    expect(screenOf(s)).toBe('hall');
    for (let i = 0; i < 5 && !s.death; i++) s = clear(doFirst(s, (a) => a.t === 'hall' && a.what === 'train'));
    if (!s.death) {
      expect(dateOf(s.day)).toMatchObject({ year: 831, month: 2 });
      expect(screenOf(s)).toBe('muster');
    }
  });
  it('saves round-trip, as JSON and as a save code', async () => {
    let s = clear(sandbox());
    s = clear(doFirst(s, (a) => a.t === 'recruit'));
    const loaded = fromSave(JSON.parse(JSON.stringify(toSave(s, content))), content);
    expect(loaded.state).toEqual(s);
    expect(loaded.warnings).toEqual([]);
    const code = await encodeSaveCode(toSave(s, content));
    expect(code.startsWith('VIKR1.')).toBe(true);
    expect(fromSave(await decodeSaveCode(code), content).state).toEqual(s);
  });
  it('the same seed and choices give the same life', () => {
    const a = playLife(content, 'raider', 99, 3);
    const b = playLife(content, 'raider', 99, 3);
    expect(a.state).toEqual(b.state);
  });
  it('a bot life actually plays: years pass, the hero ages, deeds are done', () => {
    let played = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      const r = playLife(content, 'raider', seed, 5, seed % 2 ? 'younger_son' : 'freedman');
      expect(r.error).toBeNull();
      played += r.years;
      if (!r.state.death) {
        expect(r.years).toBe(5);
        expect(r.state.stats.legs).toBeGreaterThan(3);
        expect(livingFame(r.state) + r.state.deeds.length).toBeGreaterThan(0);
      }
    }
    expect(played).toBeGreaterThan(10);
  });
});
