import { describe, it, expect } from 'vitest';
import { content } from '../helpers';
import { act, listActions, newGame } from '../../src/engine/index';
import type { BattleState, DuelState, GameState, Pending } from '../../src/engine/state';
import { open } from '../../src/engine/director';
import { dayOf } from '../../src/engine/calendar';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { deployStep, fightOutWall, project, startWall, wallAuto, wallRound, WALL } from '../../src/engine/wall';
import { BOUT, boutExchange, projectBout } from '../../src/engine/bout';

// docs/FRAME-COMBAT-2.md: the enemy's move is shown, every order shows what it will do, chance moves numbers only.
function bangor(seed: number, flags: Record<string, number> = {}): GameState {
  let s = newGame(content, { background: 'younger_son', seed, name: 'Ari' });
  s.pending = null; s.day = dayOf(830, 170); s.at = 'bangor'; s.phase = 'sailing';
  s.crew.men = 36; s.crew.morale = 6; s.crew.quality = 1;
  Object.assign(s.flags, flags);
  open(s, 'b_wall', content);
  s = act(content, s, { t: 'choose', id: 'wall' });
  return s;
}
const battle = (s: GameState): BattleState => (s.pending as unknown as Pending & { battle: BattleState }).battle;

function holmgang(seed: number): GameState {
  let s = newGame(content, { background: 'younger_son', seed, name: 'Ari' });
  s.pending = null; s.day = dayOf(830, 359); s.at = 'home_fjord'; s.phase = 'winter';
  open(s, 'y_holm_eve', content);
  s = act(content, s, { t: 'choose', id: 'fight' });
  return s;
}
const duel = (s: GameState): DuelState => (s.pending as unknown as Pending & { duel: DuelState }).duel;

describe('the new shield-wall (Bangor)', () => {
  it('in his own wall, opens on deployment: the sworn men, the reserve, his place', () => {
    const s = bangor(1);
    s.service = null;
    const b = battle(s);
    b.wall = undefined;
    startWall(b, true, new RngCursor(seedRng(1)));
    expect(b.wall!.phase).toBe('deploy');
    const men = b.us.men;
    deployStep(b, 'sworn', 'front');
    deployStep(b, 'reserve', '0.3');
    deployStep(b, 'pos', 'rear');
    expect(b.wall!.phase).toBe('fight');
    expect(b.wall!.reserveMen).toBe(Math.round(men * 0.3));
    expect(b.us.men).toBe(men - b.wall!.reserveMen);
  });

  it("in Ásgeir's wall, goes straight to the fight and shows a projection on every order", () => {
    const s = bangor(1);
    expect(battle(s).wall?.phase).toBe('fight');
    const orders = listActions(s, content).filter((o) => o.action.t === 'wall_order');
    expect(orders.length).toBe(6);
    for (const o of orders.filter((x) => x.enabled)) expect(o.hint).toMatch(/\d/);
  });

  it('resolves the move it showed: locked shields beat a charge, and a push into it costs more', () => {
    const s = bangor(2);
    const b = battle(s);
    b.wall!.phase = 'fight';
    b.wall!.intent = 'charge';
    const brace = project(b, 'brace'), press = project(b, 'press');
    expect(brace.taken).toBeLessThan(press.taken);
    expect(brace.theirCohesion).toBeLessThan(b.them.morale - 1);
    wallRound(b, 'brace', new RngCursor(seedRng(1)));
    expect(b.log.at(-1)).toMatch(/charge/);
  });

  it('springs the trap on a man who follows a feigned retreat', () => {
    const b = battle(bangor(3));
    b.wall!.phase = 'fight';
    b.wall!.intent = 'feint';
    const press = project(b, 'press'), brace = project(b, 'brace');
    expect(press.ourCohesion).toBeLessThan(brace.ourCohesion);
    expect(press.ground).toBe(b.wall!.ground);
  });

  it('rewards reading them: instinct beats pushing every round', () => {
    let auto = 0, push = 0;
    for (let i = 0; i < 60; i++) {
      const a = battle(bangor(100 + i, { bg_seen: 1 }));
      fightOutWall(a, new RngCursor(seedRng(i)));
      if (a.over === 'won') auto++;
      const p = battle(bangor(100 + i, { bg_seen: 1 }));
      p.wall!.phase = 'fight';
      const rng = new RngCursor(seedRng(i));
      let g = 0;
      while (!p.over && g++ < 20) wallRound(p, project(p, 'press').available ? 'press' : wallAuto(p), rng);
      if (p.over === 'won') push++;
    }
    expect(auto).toBeGreaterThan(push + 15);
  });

  it('ends within the day', () => {
    const b = battle(bangor(4));
    fightOutWall(b, new RngCursor(seedRng(4)));
    expect(b.over).toBeTruthy();
    expect(b.round).toBeLessThanOrEqual(WALL.maxRounds);
  });
});

describe('the new single combat (the Yule holmgang)', () => {
  it('shows his move, and each answer with its cost', () => {
    const s = holmgang(1);
    const d = duel(s);
    expect(d.bout).toBeTruthy();
    const moves = listActions(s, content).filter((o) => o.action.t === 'bout_move');
    expect(moves.length).toBe(5);
  });

  it('splits shields, not men, when a great blow meets a raised shield', () => {
    const d = duel(holmgang(2));
    d.bout!.foeIntent = 'guard';
    const p = projectBout(d, 'heavy');
    expect(p.toFoe).toBe(0);
    expect(p.stamina).toBe(d.hero.stamina - BOUT.cost.heavy);
  });

  it('knocks a man off balance who rushes a quick blade', () => {
    const d = duel(holmgang(3));
    d.bout!.foeIntent = 'bash';
    boutExchange(d, 'quick', new RngCursor(seedRng(3)));
    expect(d.bout!.foeOff).toBe(true);
  });

  it('counts three steps back as stepping off the cloak', () => {
    const d = duel(holmgang(4));
    const rng = new RngCursor(seedRng(4));
    let g = 0;
    while (!d.over && g++ < 10) { d.bout!.foeIntent = 'guard'; d.hero.stamina = 5; boutExchange(d, 'back', rng); }
    expect(d.over).toBe('yielded');
    expect(d.bout!.heroEdge).toBeGreaterThanOrEqual(BOUT.edge);
  });
});
