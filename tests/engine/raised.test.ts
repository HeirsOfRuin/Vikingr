import { describe, it, expect } from 'vitest';
import { content } from '../helpers';
import { act, listActions, newGame } from '../../src/engine/index';
import type { GameState } from '../../src/engine/state';

// Josh, 2026-11-15: "Each should have their own background specific scenes, not generic for each (like a tradesman
// son having the Irish grandmother)". Each way of being raised plays its own boyhood scenes, and none of another's.
const OWN: Record<string, string[]> = {
  boatwright: ['f_yard', 'f_faering'], trader: ['f_scales', 'f_tally'], grandmother: ['f_door', 'f_amma'],
  sword: ['b_spear'], oar: ['b_skerries'], table: ['b_table'],
  killer: ['o_first'], poacher: ['o_weir'], talker: ['o_tongue'],
};
const ALL = Object.values(OWN).flat();

/** Plays the boyhood on the first choice each time, and returns every scene it opened, until the first summer. */
function boyhood(background: string, skillSet: string, pick = 0): { seen: string[]; s: GameState } {
  let s = newGame(content, { background, seed: 11, name: 'Ari', skillSet });
  const seen: string[] = [];
  for (let i = 0; i < 40 && s.pending; i++) {
    if (s.pending.t === 'scene') {
      const id = s.pending.id;
      if (!seen.includes(id)) seen.push(id);
      if (id === 'm_landing' || id === 'o_passage') break;
    }
    const opts = listActions(s, content).filter((o) => o.enabled);
    s = act(content, s, (opts[Math.min(pick, opts.length - 1)] ?? opts[0]!).action);
  }
  return { seen, s };
}

describe('each way of being raised has its own boyhood', () => {
  for (const b of Object.values(content.backgrounds)) {
    for (const set of b.skill_sets) {
      it(`${b.id}, ${set.label}: its own scenes, and none of another's`, () => {
        for (const pick of [0, 1, 2]) {
          const { seen, s } = boyhood(b.id, set.id, pick);
          expect(s.hero.raised).toBe(set.id);
          for (const id of OWN[set.id]!) expect(seen).toContain(id);
          for (const id of ALL.filter((x) => !OWN[set.id]!.includes(x))) expect(seen).not.toContain(id);
        }
      });
    }
  }

  it("only the grandmother's grandson learns Irish in his boyhood", () => {
    for (const set of ['boatwright', 'trader', 'grandmother']) {
      const got = [0, 1, 2].some((p) => boyhood('freedman', set, p).s.flags.irish);
      expect(got).toBe(set === 'grandmother');
    }
  });

  it('a save made before the ways of being raised were kept plays the old scenes', () => {
    const s = newGame(content, { background: 'freedman', seed: 11, name: 'Ari' });
    delete s.hero.raised;
    s.pending = null;
    const t = act(content, { ...s, pending: { t: 'report', title: 'x', lines: ['x'], next: 'f_yard' } } as GameState, { t: 'continue' });
    expect(t.pending).toEqual({ t: 'scene', id: 'f_yard' });
  });
});
