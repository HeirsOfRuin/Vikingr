import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, listActions, newGame } from '../../src/engine/index';
import type { BattleState, DuelState, GameState, Pending } from '../../src/engine/state';
import { open } from '../../src/engine/director';
import { dayOf } from '../../src/engine/calendar';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { deployStep, fightOutWall, orderDesc, project, readRoll, startWall, wallAdvice, wallAuto, wallRound, WALL, type WallOrder } from '../../src/engine/wall';
import { BOUT, boutExchange, foeIntent, projectBout } from '../../src/engine/bout';
import { startBattle, startDuel, veteranChance } from '../../src/engine/fights';
import { addDeed, livingFame } from '../../src/engine/fame';

// docs/FRAME-COMBAT-2.md: the enemy's move is shown as well as he can read it; orders say what they do, not what they will do.
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
    const rng = new RngCursor(seedRng(2));
    deployStep(b, 'sworn', 'front', rng);
    deployStep(b, 'reserve', '0.3', rng);
    deployStep(b, 'pos', 'rear', rng);
    expect(b.wall!.phase).toBe('fight');
    expect(b.wall!.reserveMen).toBe(Math.round(men * 0.3));
    expect(b.us.men).toBe(men - b.wall!.reserveMen);
  });

  it("in Ásgeir's wall, goes straight to the fight; the orders say what they do, not what they will do", () => {
    const s = bangor(1);
    const b = battle(s);
    expect(b.wall?.phase).toBe('fight');
    const orders = listActions(s, content).filter((o) => o.action.t === 'wall_order');
    expect(orders.length).toBe(6); // no reserve kept in Ásgeir's wall
    for (const o of orders) expect(o.hint).toBe(orderDesc(b, (o.action as { order: WallOrder }).order));
    for (const o of orders) expect(o.hint).not.toMatch(/lose about|spirit/);
  });

  it('reads an honest enemy for certain, and a cunning one only sometimes', () => {
    const rng = new RngCursor(seedRng(9));
    for (let i = 0; i < 50; i++) expect(readRoll(3, 0, rng)).toBe('sure');
    const reads = Array.from({ length: 400 }, () => readRoll(4, 2, rng));
    expect(reads.filter((r) => r === 'sure').length).toBeLessThan(100);
    expect(reads.filter((r) => r === 'torn').length).toBeGreaterThan(50);
    const b = battle(bangor(5, { bg_seen: 1 }));
    expect(b.wall!.guile).toBe(2);
    let torn = 0;
    for (let i = 0; i < 30 && !b.over; i++) {
      if (b.wall!.read === 'torn') { torn++; expect(b.wall!.shown).toContain(b.wall!.intent); expect(b.wall!.shown.length).toBe(2); }
      wallRound(b, 'brace', rng);
    }
  });

  it('a levy runs when its leader falls; a lord\'s men close round him once', () => {
    const b = battle(bangor(6, { bg_seen: 1 }));
    expect(b.wall!.leader).toMatch(/gilded helmet/);
    b.wall!.resolve = 'levy';
    const before = b.them.morale;
    const always = { float: () => 0, int: () => 0, pickWeighted: <T,>(xs: T[]) => xs[0] } as unknown as RngCursor;
    b.wall!.intent = 'brace';
    wallRound(b, 'lord', always);
    expect(b.wall!.leaderDown).toBe(true);
    expect(b.them.morale).toBeLessThanOrEqual(before - WALL.resolve.levy.leaderFall);
    const h = battle(bangor(7));
    h.wall!.resolve = 'hird';
    h.them.morale = 0.5;
    h.wall!.intent = 'brace';
    wallRound(h, 'charge', new RngCursor(seedRng(7)));
    expect(h.wall!.stood).toBe(true);
    expect(h.over).toBeNull();
  });

  it('an old hand shouts advice while he is new, and stops once he has fought enough', () => {
    const s = bangor(8);
    expect(wallAdvice(battle(s))?.text).toBeTruthy();
    const v = newGame(content, { background: 'younger_son', seed: 8, name: 'Ari' });
    v.stats.battles = WALL.adviceUntil;
    v.pending = null; v.day = dayOf(830, 170); v.at = 'bangor'; v.phase = 'sailing';
    open(v, 'b_wall', content);
    const w = act(content, v, { t: 'choose', id: 'wall' });
    expect(wallAdvice(battle(w))).toBeNull();
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
    expect(auto).toBeGreaterThan(push + 10);
  });

  it('ends within the day', () => {
    const b = battle(bangor(4));
    fightOutWall(b, new RngCursor(seedRng(4)));
    expect(b.over).toBeTruthy();
    expect(b.round).toBeLessThanOrEqual(WALL.maxRounds);
  });
});

describe('the new single combat (the Yule holmgang)', () => {
  it('shows his move, and each answer with what it costs', () => {
    const s = holmgang(1);
    const d = duel(s);
    expect(d.bout).toBeTruthy();
    // Thorgils swings first and keeps swinging: easy to read
    expect(d.bout!.guile).toBe(0);
    expect(d.bout!.read).toBe('sure');
    const moves = listActions(s, content).filter((o) => o.action.t === 'bout_move');
    expect(moves.length).toBe(5);
    for (const m of moves) expect(m.hint).not.toMatch(/takes about/);
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

describe('every fight in the second form, and renown (revision 3)', () => {
  it('every battle and single combat starts in the new form, wherever it comes from', () => {
    const s = sandboxGame(21);
    s.phase = 'sailing'; s.at = 'man'; s.crew.men = 30;
    startBattle(s, content, { foe: 'island_men', men: 10, terrain: 'beach', context: 'raid', place: 'man' });
    expect((s.pending as unknown as { battle: BattleState }).battle.wall).toBeTruthy();
    const t = sandboxGame(22);
    startDuel(t, content, 'local_champion', 'duel', false);
    expect((t.pending as unknown as { duel: DuelState }).duel.bout).toBeTruthy();
  });

  it('nobody comes looking for an oarsman, or for a man nobody has heard of', () => {
    const s = sandboxGame(23);
    s.day = dayOf(834, 150);
    expect(veteranChance(s)).toBe(0);
    for (let i = 0; i < 10; i++) addDeed(s, content, { type: 'deed', text: `A great deed ${i}`, weight: 10, witnesses: 400 });
    expect(livingFame(s)).toBeGreaterThanOrEqual(40);
    expect(veteranChance(s)).toBeGreaterThan(0);
    s.service = { captain: 'Ásgeir', route: [], shares: 1 } as never;
    expect(veteranChance(s)).toBe(0);
  });

  it('a man who came to kill does not pay his way off the cloak; Thorgils may', () => {
    expect(content.fighters.ch_grjotgard!.unyielding).toBe(true);
    expect(content.fighters.thorgils!.unyielding).toBeUndefined();
    for (const id of ['ch_hrafn', 'ch_cu_mara', 'ch_kinsman', 'ch_wolfcoat', 'ch_grjotgard']) expect(content.scenes[id]).toBeTruthy();
  });

  it("in another man's wall he is asked where he stands, unless the scene has just put him there", () => {
    const s = sandboxGame(24);
    s.service = { captain: 'Ásgeir', route: [], shares: 1 } as never;
    s.phase = 'sailing'; s.at = 'man';
    startBattle(s, content, { foe: 'island_men', men: 10, terrain: 'beach', context: 'sea', place: null });
    const w = (s.pending as unknown as { battle: BattleState }).battle.wall!;
    expect(w.phase).toBe('deploy');
    expect(w.step).toBe('pos');
    expect(battle(bangor(25)).wall!.phase).toBe('fight');
  });

  it('a cornered man on the cloak does not step back off it', () => {
    const d = duel(holmgang(30));
    d.bout!.foeEdge = 1;
    d.foe.stamina = 1;
    const rng = new RngCursor(seedRng(30));
    for (let i = 0; i < 20; i++) expect(foeIntent(d, rng)).not.toBe('back');
  });
});
