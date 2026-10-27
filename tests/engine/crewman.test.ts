import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import type { GameState, SwornMan } from '../../src/engine/state';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { banter } from '../../src/engine/banter';
import { open, fireQueued } from '../../src/engine/director';
import { renderText } from '../../src/engine/text';
import { applyEffects } from '../../src/engine/effects';
import { crewBynames, focusMan, mournMan, pickCrewman } from '../../src/engine/crewman';

const hirdman = (id: string, name: string, temperament: string, extra: Partial<SwornMan> = {}): SwornMan => ({
  id, name, temperament, weapons: 3, loyalty: 6, alive: true, slot: 'wall', deeds: 0, nickname: null, diedOn: null, sworn: true, hurtUntil: null, origin: 'bench', ...extra,
});

const lord = (): GameState => {
  const s = sandboxGame(5);
  for (const m of s.men) { m.alive = false; m.diedOn = s.day; } // the four bench-mates are gone
  s.men.push(hirdman('g1_a', 'Thorbjorn', 'hot'), hirdman('g2_b', 'Egil', 'greedy'));
  return s;
};

describe('the crew as people', () => {
  it('a temperament line is said by a living sworn man of that temperament, by name', () => {
    const s = lord();
    const said = new Set<string>();
    for (let i = 0; i < 60; i++) {
      for (const k of Object.keys(s.flags)) if (k.startsWith('_banter')) delete s.flags[k];
      const line = banter(s, content, new RngCursor(seedRng(i)), 'sea');
      if (line) said.add(/Thorbjorn/.test(line) ? 'Thorbjorn' : /Egil/.test(line) ? 'Egil' : 'other');
    }
    expect(said.has('Thorbjorn')).toBe(true);
    expect(said.has('Egil')).toBe(true);
    expect(said.has('other')).toBe(false);
  });

  it('a crew scene is about one man of its temperament, and {man} names him', () => {
    const s = lord();
    expect(pickCrewman(s, 'greedy')?.name).toBe('Egil');
    expect(pickCrewman(s, 'pious')).toBeUndefined();
    open(s, 'cr_skim', content);
    expect(focusMan(s)?.name).toBe('Egil');
    expect(renderText('{man} is at the door.', s, content)).toBe('Egil is at the door.');
  });

  it('a choice acts on the man: loyalty, leaving, settling', () => {
    const s = lord();
    open(s, 'cr_skim', content);
    const rng = new RngCursor(seedRng(1));
    applyEffects(s, content, rng, [{ crewman: { loyalty: -2 } }]);
    expect(s.men.find((m) => m.name === 'Egil')!.loyalty).toBe(4);
    const pool = s.musterPool;
    applyEffects(s, content, rng, [{ crewman: { settle: true } }]);
    expect(s.men.some((m) => m.name === 'Egil')).toBe(false);
    expect(s.musterPool).toBe(pool + 2);
  });

  it("his own holmgang: win or die, and the scene after is about him", () => {
    let won = 0, died = 0;
    for (let i = 0; i < 40; i++) {
      const s = lord();
      open(s, 'cr_quarrel', content);
      s.pending = null;
      applyEffects(s, content, new RngCursor(seedRng(i)), [{ crewman: { fights: { foe: 'local_champion', win: 'cr_quarrel_won', lose: 'cr_quarrel_lost' } } }]);
      const t = s.men.find((m) => m.name === 'Thorbjorn')!;
      if (t.alive) won++; else died++;
      expect(fireQueued(s, content)).toBe(true);
      expect(focusMan(s)?.name).toBe('Thorbjorn');
    }
    expect(won).toBeGreaterThan(0);
    expect(died).toBeGreaterThan(0);
  });

  it('a fallen hirdman is mourned by name, and a man with deeds earns a byname', () => {
    const s = lord();
    const t = s.men.find((m) => m.name === 'Thorbjorn')!;
    t.alive = false;
    mournMan(s, content, t);
    s.pending = null;
    s.day += 1;
    expect(fireQueued(s, content)).toBe(true);
    expect((s.pending as unknown as { id: string }).id).toBe('mourn_hird');
    expect(renderText('{man} is dead.', s, content, { keepDead: true })).toBe('Thorbjorn is dead.');
    const e = s.men.find((m) => m.name === 'Egil')!;
    e.deeds = 3;
    expect(crewBynames(s).join(' ')).toMatch(/Egil/);
    expect(e.nickname).toBeTruthy();
  });
});
