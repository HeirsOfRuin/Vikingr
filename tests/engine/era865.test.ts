// The Great Army, 865 (docs/FRAME-865.md).
import { describe, it, expect } from 'vitest';
import { content } from '../helpers';
import { newGame, act } from '../../src/engine/index';
import { dayOf } from '../../src/engine/calendar';
import { playLife } from '../../tools/bot-lib';
import { applyEffects } from '../../src/engine/effects';
import { RngCursor, seedRng } from '../../src/engine/rng';

describe('the Great Army, 865', () => {
  it('thirty-five years of the chronicle, then the sons of Ragnarr', () => {
    const s = newGame(content, { background: 'younger_son', seed: 3, name: 'Ari', era: 865 });
    expect(s.day).toBe(dayOf(865, 59));
    expect(s.hero.born).toBe(849);
    expect(s.flags.era865).toBe(1);
    expect(s.places.noirmoutier!.norse).toBe(true);
    // the Loire years are past: their scenes never open
    expect(s.seen.e43_arrow).toBeDefined();
    const lines = (s.pending as { lines: string[] }).lines;
    expect(lines.length).toBeLessThanOrEqual(12);
    expect(lines.join(' ')).not.toMatch(/when you were -?[0-4]:/);
    let t = act(content, s, { t: 'continue' });
    expect(t.pending).toEqual({ t: 'scene', id: 'e65_boyhood' });
    t = act(content, t, { t: 'choose', id: 'yard' });
    t = act(content, t, { t: 'continue' });
    expect(t.pending).toEqual({ t: 'scene', id: 'e65_call' });
    t = act(content, t, { t: 'choose', id: 'bench' });
    expect(t.service?.captain).toBe('Kolr');
    expect(t.fleet?.id).toBe('greatarmy');
  });

  it("the army's camp moves, and a captain may winter in it however the English feel", () => {
    const s = newGame(content, { background: 'younger_son', seed: 3, name: 'Ari', era: 865 });
    s.fleet = { id: 'greatarmy', since: s.day };
    applyEffects(s, content, new RngCursor(seedRng(1)), [{ camp: 'nottingham' }]);
    expect(s.fleet.camp).toBe('nottingham');
    expect(s.known).toContain('nottingham');
  });

  it('bot lives in 865 play on without dead ends, and reach York', () => {
    for (const bg of ['younger_son', 'outlaw', 'freedman']) {
      const r = playLife(content, 'raider', 700, 3, bg, undefined, { era: 865 });
      expect(r.error).toBeFalsy();
      expect(r.state.seen.e66_york_taken).toBeDefined();
    }
  }, 60000);
});
