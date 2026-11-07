// The Middle Sea, 859-861 (docs/FRAME-MED.md): the voyage runs end to end, the winters pass off the map, and the fleet ends.
import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, listActions } from '../../src/engine/index';
import { dayOf, dateOf } from '../../src/engine/calendar';
import { Bot } from '../../tools/bot-lib';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { atHome } from '../../src/engine/settle';
import type { GameState } from '../../src/engine/state';

export function voyage(seed: number): { s: GameState; ended: 'home' | 'early' | 'dead' | 'stuck'; loot: number; silver: number; men: number; ships: number } {
  let s = sandboxGame(seed);
  s.ships.push({ id: 'second', type: 'karvi', name: 'the Otter', hull: 90 });
  s.crew.men = 50;
  s.day = dayOf(859, 120);
  s.phase = 'sailing';
  s.at = 'noirmoutier';
  s.known.push('noirmoutier', 'nantes');
  s.places.noirmoutier!.norse = true;
  s.seen.mh_word_spring = s.day;
  const bot = new Bot('raider', new RngCursor(seedRng(seed * 7 + 1)));
  const start = { loot: s.loot, silver: s.silver };
  // to the council, and into the fleet
  for (let i = 0; i < 20 && !(s.pending?.t === 'scene' && s.pending.id === 'mh_council'); i++) s = act(content, s, bot.choose(s, content)!);
  expect(s.pending).toEqual({ t: 'scene', id: 'mh_council' });
  s = act(content, s, { t: 'choose', id: 'go' });
  expect(s.fleet?.id).toBe('med859');
  for (let i = 0; i < 3000; i++) {
    if (s.death) return { s, ended: 'dead', loot: s.loot - start.loot, silver: s.silver - start.silver, men: s.crew.men, ships: s.ships.length };
    if (s.seen.mh_home && !s.pending) return { s, ended: 'home', loot: s.loot - start.loot, silver: s.silver - start.silver, men: s.crew.men, ships: s.ships.length };
    if (s.seen.mh_home_early && !s.pending) return { s, ended: 'early', loot: s.loot - start.loot, silver: s.silver - start.silver, men: s.crew.men, ships: s.ships.length };
    s = act(content, s, bot.choose(s, content)!);
  }
  return { s, ended: 'stuck', loot: 0, silver: 0, men: 0, ships: 0 };
}

describe('the Middle Sea', () => {
  it('a voyage ends home, home early, or dead; never stuck, and two winters pass', () => {
    const tally = { home: 0, early: 0, dead: 0, stuck: 0 };
    for (let seed = 1; seed <= 24; seed++) {
      const r = voyage(seed);
      tally[r.ended]++;
      if (r.ended === 'home') {
        expect(dateOf(r.s.day).year).toBe(861);
        expect(r.s.fleet).toBeFalsy();
        expect(r.s.at).toBe('noirmoutier');
        expect(r.s.flags._far).toBeUndefined();
        expect(r.s.journal.some((j) => /Wintered a second time in the Camargue/.test(j.text))).toBe(true);
      }
    }
    expect(tally.stuck).toBe(0);
    expect(tally.home + tally.early).toBeGreaterThan(0);
  });

  it('a far winter is not a winter at home, even where his house is', () => {
    const s = sandboxGame(3);
    s.at = 'home_fjord';
    expect(atHome(s)).toBe(true);
    s.flags._far = 1;
    expect(atHome(s)).toBe(false);
  });

  it('the word reaches a captain wintering anywhere in 858', () => {
    const s = sandboxGame(4);
    s.day = dayOf(858, 320);
    s.phase = 'winter';
    s.flags._winter = 858;
    s.hallLeft = 2;
    expect(content.scenes.mh_word).toBeDefined();
    expect(listActions(s, content).length).toBeGreaterThan(0);
  });
});
