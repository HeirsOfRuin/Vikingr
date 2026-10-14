import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { routes } from '../../src/engine/voyage';
import { startRaid } from '../../src/engine/fights';
import { RngCursor } from '../../src/engine/rng';

// docs/FRAME-PLACES-2.md: twelve places made reachable
const TWELVE = ['hladir', 'uppsala', 'gotland', 'truso', 'man', 'dublin', 'clonmacnoise', 'york', 'sheppey', 'london', 'noirmoutier', 'nantes'];

describe('the twelve new places', () => {
  it('are active, on a sea road, and each has an arrival scene', () => {
    for (const id of TWELVE) {
      expect(content.places[id]!.active, id).toBe(true);
      expect(content.legs.some((l) => (l.a === id || l.b === id) && !l.expedition), id).toBe(true);
      expect(Object.values(content.scenes).some((s) => s.kind === 'place' && s.at?.includes(id)), id).toBe(true);
    }
  });

  it('are found by rumour or by the neighbours who tell of them', () => {
    for (const id of TWELVE) {
      const heard = Object.values(content.places).some((p) => p.id !== id && (p.tells?.includes(id) || p.rumours?.includes(id)));
      expect(heard, id).toBe(true);
    }
  });

  it('a rumoured place on a known sea road can be sailed to', () => {
    const s = sandboxGame(3);
    s.pending = null;
    s.at = 'bangor';
    if (!s.known.includes('bangor')) s.known.push('bangor');
    s.rumoured.push('man');
    expect(routes(s, content, 'bangor').some((r) => r.to === 'man')).toBe(true);
  });

  it('a scouted place is easier to catch asleep', () => {
    const roll = (scouted: boolean) => {
      const s = sandboxGame(3);
      s.pending = null;
      s.service = null;
      s.at = 'nantes';
      s.hero.skills.cunning = 0;
      if (scouted) s.flags.nantes_scouted = 1;
      // a roll of 0.5: above the plain odds, below the scouted ones
      startRaid(s, content, { float: () => 0.5, int: () => 0 } as unknown as RngCursor, 'nantes');
      const pd = s.pending as import('../../src/engine/state').Pending | null;
      return pd?.t === 'battle' ? pd.battle.log[0] : '';
    };
    expect(roll(false)).toMatch(/waiting/);
    expect(roll(true)).toMatch(/asleep/);
  });
});
