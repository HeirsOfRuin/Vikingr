import { describe, it, expect } from 'vitest';
import { ORDERS } from '../../src/content/schema';
import { MATCHUP, resolveRound, fightOutBattle, adaptivePolicy, availableOrders } from '../../src/engine/battle';
import { RngCursor, seedRng } from '../../src/engine/rng';
import type { BattleState, Position } from '../../src/engine/state';

const battle = (ours: number, theirs: number, position: Position = 'wall', terrain: BattleState['terrain'] = 'beach'): BattleState => ({
  foeId: 'rival_crew', terrain, position, round: 0, log: [], heroDown: false, heroHp: 16, heroHpMax: 16, heroArmour: 1, heroHits: [], named: [], deeds: [], over: null, context: 'scene', place: null, killed: 0, lost: 0,
  us: { name: 'us', men: ours, start: ours, quality: 1, morale: 6, doctrine: {}, last: null },
  them: { name: 'them', men: theirs, start: theirs, quality: 1, morale: 7, doctrine: { push: 3, hold: 2 }, last: null },
});

describe('battle', () => {
  it('the order table is antisymmetric', () => {
    for (const a of ORDERS) for (const b of ORDERS) expect(MATCHUP[a][b]).toBe(-MATCHUP[b][a] || 0);
  });
  it('a round kills men on both sides and is deterministic', () => {
    const a = resolveRound(battle(30, 30), 'hold', 'push', new RngCursor(seedRng(1)));
    const b = resolveRound(battle(30, 30), 'hold', 'push', new RngCursor(seedRng(1)));
    expect(a).toEqual(b);
    expect(a.killed + a.lost).toBeGreaterThan(0);
  });
  it('battles end within the round limit', () => {
    const rng = new RngCursor(seedRng(2));
    for (let i = 0; i < 100; i++) {
      const b = fightOutBattle(battle(25, 20), adaptivePolicy, rng);
      expect(b.over).not.toBeNull();
      expect(b.round).toBeGreaterThan(0);
      expect(b.round).toBeLessThanOrEqual(10);
    }
  });
  it('more men win more often', () => {
    const rng = new RngCursor(seedRng(3));
    let big = 0, small = 0;
    for (let i = 0; i < 300; i++) {
      if (fightOutBattle(battle(45, 25), adaptivePolicy, rng).over === 'won') big++;
      if (fightOutBattle(battle(25, 45), adaptivePolicy, rng).over === 'won') small++;
    }
    expect(big).toBeGreaterThan(small * 2);
  });
  it('the front rank is more dangerous than the rear (a measured difference)', () => {
    const rng = new RngCursor(seedRng(4));
    const hits = { front: 0, rear: 0 };
    for (let i = 0; i < 400; i++) for (const p of ['front', 'rear'] as const) hits[p] += fightOutBattle(battle(30, 30, p), adaptivePolicy, rng).heroHits.length;
    expect(hits.front).toBeGreaterThan(hits.rear * 3);
  });
  it('no flanking on a ship', () => {
    expect(availableOrders(battle(60, 20, 'wall', 'ship'), 'us')).not.toContain('flank');
    expect(availableOrders(battle(60, 20, 'wall', 'beach'), 'us')).toContain('flank');
  });
});
