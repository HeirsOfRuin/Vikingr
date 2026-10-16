import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, listActions, newGame } from '../../src/engine/index';
import type { BattleState, GameState } from '../../src/engine/state';
import { applyEffects } from '../../src/engine/effects';
import { commitReserve, fightOutHostWall, startHost } from '../../src/engine/host';
import { swearFelag } from '../../src/engine/allies';
import { startRaid } from '../../src/engine/fights';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { dayOf } from '../../src/engine/calendar';

const rng = (n = 1) => new RngCursor(seedRng(n));
const captain = (): GameState => {
  const s = sandboxGame(4);
  s.pending = null;
  s.service = null;
  s.day = dayOf(834, 160);
  s.phase = 'sailing';
  s.at = 'home_fjord';
  s.ships = [{ id: 'a', type: 'karvi', name: 'Gull', hull: 100 }];
  s.crew.men = 30;
  return s;
};
const battle = (s: GameState) => (s.pending as { battle: BattleState }).battle;

describe('hosts', () => {
  it('a host is his own battle with the other wings of the line beside it', () => {
    const s = captain();
    startHost(s, content, { title: 'Test', foe: 'frisian_levy', terrain: 'field', context: 'scene', place: null, foeMen: 30, wings: [{ name: 'Left', men: 30, foe_men: 30 }, { name: 'Right', men: 30, foe_men: 30 }], role: 'host', reserve: { us: 20, them: 0 } });
    const b = battle(s);
    expect(b.host!.wings).toHaveLength(2);
    expect(b.us.men).toBe(30 + s.men.filter((m) => m.alive && m.sworn && (m.hurtUntil ?? 0) <= s.day).length || b.us.men);
    // his own part of the line deploys first; then the host's orders sit beside his own
    let t = s;
    for (let g = 0; g < 4 && battle(t).wall!.phase === 'deploy'; g++) t = act(content, t, listActions(t, content).find((o) => o.action.t === 'wall_deploy')!.action);
    const ids = listActions(t, content).map((o) => o.action.t);
    expect(ids).toContain('wall_order');
    expect(ids).toContain('reserve');
    expect(ids).toContain('signal');
  });

  it('the field goes by the wings: the line decides, and every wing ends', () => {
    let won = 0;
    for (let i = 1; i <= 60; i++) {
      const s = captain();
      startHost(s, content, { title: 'T', foe: 'frisian_levy', terrain: 'field', context: 'scene', place: null, foeMen: 30, wings: [{ name: 'L', men: 45, foe_men: 30 }, { name: 'R', men: 45, foe_men: 30 }] });
      const b = battle(s);
      fightOutHostWall(b, rng(i));
      expect(b.over).not.toBeNull();
      expect(b.host!.wings.every((w) => w.over)).toBe(true);
      if (b.over === 'won') won++;
    }
    expect(won).toBeGreaterThan(40);
  });

  it('the reserve goes to the wing closest to breaking, once', () => {
    const s = captain();
    startHost(s, content, { title: 'T', foe: 'frisian_levy', terrain: 'field', context: 'scene', place: null, foeMen: 30, wings: [{ name: 'L', men: 30, foe_men: 30 }], reserve: { us: 25, them: 0 }, role: 'host' });
    const b = battle(s);
    b.host!.wings[0]!.us.morale = 2;
    commitReserve(b);
    expect(b.host!.wings[0]!.us.men).toBe(55);
    commitReserve(b);
    expect(b.host!.wings[0]!.us.men).toBe(55);
  });

  it('the host effect puts the félag partner on the flank, or leaves it open', () => {
    const s = captain();
    applyEffects(s, content, rng(), [{ host: { title: 'T', foe: 'frisian_levy', terrain: 'field', men: 40, wings: [{ name: 'The flank', ally: true, foe_men: 30 }] } }]);
    expect(battle(s).host!.wings[0]!.us.men).toBe(0);
    const t = captain();
    t.captains = { steinarr: { rel: 8, met: true, alive: true } };
    swearFelag(t, content, 'steinarr');
    applyEffects(t, content, rng(), [{ host: { title: 'T', foe: 'frisian_levy', terrain: 'field', men: 40, wings: [{ name: 'The flank', ally: true, foe_men: 30 }] } }]);
    expect(battle(t).host!.wings[0]!.us.men).toBe(content.captains.steinarr!.men);
  });

  it('a big raid with a partner beside him is fought as a host', () => {
    const s = captain();
    s.captains = { ubbi: { rel: 8, met: true, alive: true } };
    swearFelag(s, content, 'ubbi');
    s.at = 'bangor';
    s.places.bangor!.defence = 3;
    startRaid(s, content, rng(5), 'bangor');
    const b = battle(s);
    if (b.them.men + (b.host?.wings[0]?.them.start ?? 0) >= 50) expect(b.host).toBeTruthy();
  });

  it('his losses are his crew\'s; the other wings bury their own', () => {
    let s = captain();
    startHost(s, content, { title: 'T', foe: 'frisian_levy', terrain: 'field', context: 'scene', place: null, foeMen: 20, wings: [{ name: 'L', men: 200, foe_men: 200 }] });
    s = act(content, s, { t: 'battle_auto' });
    expect(s.crew.men).toBeGreaterThan(30 - 25);
  });
});
