import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { baseActions } from '../../src/engine/index';
import type { GameState } from '../../src/engine/state';
import { applyEffects } from '../../src/engine/effects';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { dayOf } from '../../src/engine/calendar';
import { addDeed, lastingFame } from '../../src/engine/fame';
import { feastMult } from '../../src/engine/base';
import { kill } from '../../src/engine/hero';
import { SKALD, skaldOf, skaldRout, skaldYear } from '../../src/engine/skald';
import { favour } from '../../src/engine/allies';

const lord = (): GameState => {
  const s = sandboxGame(4);
  s.pending = null;
  s.service = null;
  s.day = dayOf(834, 150);
  s.at = 'home_fjord';
  s.ships = [{ id: 'a', type: 'karvi', name: 'Gull', hull: 100 }];
  s.silver = 500;
  applyEffects(s, content, new RngCursor(seedRng(1)), [{ skald: 'Þjóðólfr' }]);
  return s;
};

describe('the skald', () => {
  it('a save with only the old flag gets a name; Kálfr if he came from Birsay', () => {
    const s = sandboxGame(4);
    s.flags.skald = 1;
    s.flags.o_kalfr = 1;
    expect(skaldOf(s)?.name).toBe('Kálfr');
  });

  it('aboard and away from home, the deeds he sees weigh a quarter more', () => {
    const s = lord();
    const home = addDeed(s, content, { type: 'raid' });
    s.at = 'lindisfarne';
    const away = addDeed(s, content, { type: 'raid' });
    expect(away.weight).toBe(home.weight);
    skaldOf(s)!.aboard = true;
    const seen = addDeed(s, content, { type: 'raid' });
    expect(seen.weight).toBeCloseTo(home.weight * SKALD.aboardDeed, 1);
  });

  it('the home screen offers to take him to sea, and back', () => {
    const s = lord();
    const take = baseActions(s, content).find((o) => o.action.t === 'skald_aboard');
    expect(take?.label).toMatch(/Take Þjóðólfr to sea/);
    const s2 = structuredClone(s);
    skaldOf(s2)!.aboard = true;
    expect(baseActions(s2, content).find((o) => o.action.t === 'skald_aboard')?.label).toMatch(/Leave Þjóðólfr at home/);
  });

  it('he tells any feast better', () => {
    const s = lord();
    s.base.level = 'father';
    expect(feastMult(s)).toBeCloseTo(1 + SKALD.hallFeast);
    delete s.flags.skald;
    expect(feastMult(s)).toBe(1);
  });

  it('a rout with him aboard can kill him; at home he is safe', () => {
    const s = lord();
    expect(skaldRout(s, () => 0)).toBeNull();
    skaldOf(s)!.aboard = true;
    expect(skaldRout(s, () => 0.99)).toBeNull();
    expect(skaldRout(s, () => 0)).toMatch(/fell in the rout/);
    expect(s.flags.skald).toBeUndefined();
  });

  it('he wants his Yule gifts; left at home, the jarl hears your name', () => {
    const s = lord();
    const f0 = favour(s);
    const lines = skaldYear(s);
    expect(s.silver).toBe(500 - SKALD.wage);
    expect(favour(s)).toBe(f0 + SKALD.homeFavour);
    expect(lines.join(' ')).toMatch(/Yule gifts/);
    s.silver = 0;
    expect(skaldYear(s).join(' ')).toMatch(/gone to a lord/);
    expect(skaldOf(s)).toBeNull();
  });

  it('when the hero dies, the skald makes the death-song, and it lasts', () => {
    const s = lord();
    const before = lastingFame(s);
    kill(s, 'battle', 'He fell.');
    expect(lastingFame(s)).toBeGreaterThan(before);
    expect(s.deeds.at(-1)?.type).toBe('death_song');
  });

  it('a verse effect makes the last deed lasting', () => {
    const s = lord();
    addDeed(s, content, { type: 'sea_fight_won' });
    applyEffects(s, content, new RngCursor(seedRng(1)), [{ verse: 'last' }]);
    expect(s.deeds.at(-1)?.verse).toBe(true);
  });
});
