// Playtest 2026-11-07: the day after sacking Repton, "fight your way ashore" met a full Mercian host on the beach.
import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, listActions } from '../../src/engine/index';
import { dayOf } from '../../src/engine/calendar';

function atRepton(raidedAgo: number | null) {
  const s = sandboxGame(7);
  s.at = 'repton';
  s.known.push('repton');
  s.day = dayOf(867, 95);
  s.phase = 'sailing';
  s.places.repton!.standing = -10;
  if (raidedAgo !== null) s.places.repton!.lastRaided = s.day - raidedAgo;
  return s;
}

describe('landing at a hostile place', () => {
  it('just sacked: the cattle are taken without a fight', () => {
    const s = atRepton(1);
    const o = listActions(s, content).find((x) => x.action.t === 'land')!;
    expect(o.label).toMatch(/scattered/);
    const food = s.provisions;
    const t = act(content, s, o.action);
    expect(t.pending?.t).toBe('report');
    expect(t.provisions).toBeGreaterThan(food);
  });

  it('a month on, they meet you on the beach, and a badly hurt man is warned', () => {
    const s = atRepton(30);
    s.hero.hp = 2;
    const o = listActions(s, content).find((x) => x.action.t === 'land')!;
    expect(o.label).toMatch(/Fight your way ashore/);
    expect(o.hint).toMatch(/badly hurt \(2 of \d+ blood\)/);
    expect(act(content, s, o.action).pending?.t).toBe('battle');
  });
});
