import { describe, it, expect } from 'vitest';
import { content } from '../helpers';
import { act, listActions, newGame } from '../../src/engine/index';
import type { GameState } from '../../src/engine/state';
import { open } from '../../src/engine/director';
import { dayOf } from '../../src/engine/calendar';
import { legendTable } from '../../src/engine/fame';

// docs/FRAME-BEGINNINGS.md: two summers at another man's oar before a ship of his own.
const oarsman = (): GameState => {
  const s = newGame(content, { background: 'younger_son', seed: 11, name: 'Ari' });
  s.pending = null;
  s.day = dayOf(830, 170);
  s.phase = 'sailing';
  s.at = 'bangor';
  return s;
};

describe('the slower rise', () => {
  it('the men choose him at Bangor, and he takes the prow, not the ship', () => {
    let s = oarsman();
    s.fates.asgeir_falls = 1;
    open(s, 'b_oaths');
    s = act(content, s, { t: 'choose', id: 'take' });
    expect(s.service).not.toBeNull();
    expect(s.service!.captain).toBe('Steinarr');
    expect(s.service!.shares).toBe(2);
    expect(s.flags.bg_acclaimed).toBe(1);
  });

  it('no road out of spring 831 gives him a ship', () => {
    const s = oarsman();
    s.day = dayOf(831, 60);
    s.phase = 'muster';
    s.at = 'home_fjord';
    s.flags.bg_acclaimed = 1;
    s.silver = 1000;
    open(s, 'sp_831');
    for (const o of listActions(s, content).filter((x) => x.enabled)) {
      const after = act(content, s, o.action);
      expect(after.service).not.toBeNull();
    }
  });

  it('spring 832: the jarl keeps his word to the boy he noticed', () => {
    let s = oarsman();
    s.day = dayOf(832, 60);
    s.phase = 'muster';
    s.at = 'home_fjord';
    s.flags.h_jarl_trust = 1;
    s.seen.j_council = 1;
    open(s, 'sp_832');
    s = act(content, s, { t: 'choose', id: 'promised' });
    expect(s.service).toBeNull();
    expect(s.ships[0]!.name).toBe("The jarl's old karvi");
  });

  it('a boy of sixteen does not outrank the legends of his day', () => {
    const s = oarsman();
    s.day = dayOf(830, 350);
    const table = legendTable(s, content);
    expect(table.slice(0, 4).some((r) => r.hero)).toBe(false);
  });
});
