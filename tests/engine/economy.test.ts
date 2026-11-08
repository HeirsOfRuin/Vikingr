// The slower rise (Josh, 2026-11-08: "too easy to become big and rich"): a raid takes what its men can reach;
// in a host, his crews' part; the spring muster grows with the square root of fame.
import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { plunderReach, plunderAction, startPlunder, REACH } from '../../src/engine/plunder';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { MUSTER_FAME } from '../../src/engine/season';

describe('a raid takes what its men can reach', () => {
  it('a monastery is stripped whole by a crew; a great market only in part', () => {
    expect(plunderReach(30, 16)).toBe(1);
    expect(plunderReach(60, 110)).toBeCloseTo(60 / 165, 5);
    expect(plunderReach(10, 200)).toBe(REACH.floor);
    expect(plunderReach(400, 110, true)).toBe(REACH.hostMax);
  });

  it('fifty men at Dorestad take far less a round than they used to; a great host shares the street', () => {
    const grab = (hostMen: number) => {
      const s = sandboxGame(8);
      s.at = 'dorestad';
      s.crew.men = 50;
      s.places.dorestad!.wealth = 4200;
      startPlunder(s, 'dorestad', [], undefined, content, { hostMen });
      plunderAction(s, content, new RngCursor(seedRng(3)), 'grab');
      return s.pending?.t === 'plunder' ? s.pending.plunder.taken : 0;
    };
    const alone = grab(0);
    expect(alone).toBeGreaterThan(4200 * 0.14 * 0.25);
    expect(alone).toBeLessThan(4200 * 0.26 * 0.5);
    // a host his own size or so: his men reach what they would alone; a great host strips the street before him
    expect(Math.abs(grab(270) - alone)).toBeLessThanOrEqual(2);
    expect(grab(1000)).toBeLessThan(alone * 0.5);
  });
});

describe('the spring muster', () => {
  it('grows with the square root of fame', () => {
    expect(Math.floor(MUSTER_FAME * Math.sqrt(50))).toBe(10);
    expect(Math.floor(MUSTER_FAME * Math.sqrt(400))).toBe(30);
  });
});
