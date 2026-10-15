import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, listActions } from '../../src/engine/index';
import type { Pending } from '../../src/engine/state';
import { battleMorale, startBattle } from '../../src/engine/fights';
import { BATTLE } from '../../src/engine/tuning';
import { dayOf } from '../../src/engine/calendar';

// Playtest 2026-10-15: a crew at morale 2 or less counted as broken before a blow was struck,
// and lost every fight against any odds ("93 to 14"); each loss cost more morale.
describe('a sullen crew', () => {
  it('starts a fight just above breaking, not broken', () => {
    expect(battleMorale(0)).toBeGreaterThan(BATTLE.breakMorale);
    expect(battleMorale(7)).toBe(7);
  });

  it('beats a handful of islanders even at morale 0, and is told it is sullen', () => {
    let s = sandboxGame(3);
    s.pending = null;
    s.service = null;
    s.phase = 'sailing';
    s.at = 'man';
    s.crew.men = 30;
    s.crew.morale = 0;
    startBattle(s, content, { foe: 'island_men', men: 8, terrain: 'beach', context: 'sea', place: null });
    const start = s.pending as unknown as Pending;
    expect(start.t === 'battle' && start.battle.log.some((l) => /sullen/.test(l))).toBe(true);
    let g = 0;
    while ((s.pending as Pending | null)?.t === 'battle' && g++ < 40) s = act(content, s, { t: 'battle_auto' });
    expect(s.stats.battlesWon).toBeGreaterThan(0);
  });

  it('can be mended in port: a round of ale, and rest', () => {
    let s = sandboxGame(3);
    s.pending = null;
    s.service = null;
    s.phase = 'sailing';
    s.day = dayOf(834, 150);
    s.at = 'kaupang';
    s.crew.morale = 1;
    s.silver = 200;
    const ale = listActions(s, content).find((o) => o.action.t === 'ale')!;
    expect(ale.enabled).toBe(true);
    s = act(content, s, { t: 'ale' });
    expect(s.crew.morale).toBe(1 + BATTLE.aleMorale);
    s.pending = null;
    expect(listActions(s, content).find((o) => o.action.t === 'ale')!.enabled).toBe(false);
    s = act(content, s, { t: 'rest' });
    expect(s.crew.morale).toBe(Math.min(BATTLE.restCap, 1 + BATTLE.aleMorale + BATTLE.restMorale));
  });
});
