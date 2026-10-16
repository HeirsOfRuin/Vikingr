// Shield-wall balance in the second form (docs/FRAME-COMBAT-2.md): win rates, rounds and losses by how the player
// plays, by the enemy's resolve, by renown (veterans), and the hero's risk by position.
// Usage: npm run measure:battle -- [--n 2000]
// Uses the same wallRound() as play (DESIGN §3, one code path rule).
import { loadContent } from './content-loader';
import type { BattleState, Position } from '../src/engine/state';
import type { BattleTerrain, Foe, Resolve } from '../src/content/schema';
import { RngCursor, seedRng } from '../src/engine/rng';
import { available, finishDeploy, startWall, wallAuto, wallRound, WALL_ORDERS, type WallOrder } from '../src/engine/wall';

const args = process.argv.slice(2);
const N = Number(args[args.indexOf('--n') + 1] || 2000);
const content = loadContent();

function battle(foe: Foe, ours: number, q: number, theirs: number, terrain: BattleTerrain, position: Position, context: BattleState['context'], readScore: number, rng: RngCursor): BattleState {
  const b: BattleState = {
    foeId: foe.id, terrain, position, round: 0, log: [], heroDown: false, heroHp: 16, heroHpMax: 16, heroArmour: 1, heroHits: [],
    named: [{ id: 'a', name: 'A', slot: 'front', weapons: 3, down: false, hurt: false }, { id: 'b', name: 'B', slot: 'wall', weapons: 3, down: false, hurt: false }],
    deeds: [], over: null, context, place: null, killed: 0, lost: 0,
    us: { name: 'us', men: ours, start: ours, quality: q, morale: 6.4, doctrine: {}, last: null },
    them: { name: foe.name, men: theirs, start: theirs, quality: foe.quality, morale: 6 + foe.quality, doctrine: foe.doctrine, last: null },
  };
  startWall(b, true, rng, { readScore, adviser: null, foe });
  finishDeploy(b, rng);
  return b;
}

type Play = (b: BattleState, rng: RngCursor) => WallOrder;
const pick = (o: WallOrder): Play => (b) => (available(b, o).ok ? o : wallAuto(b));
const plays: [string, Play][] = [
  ['instinct', (b) => wallAuto(b)],
  ['random', (b, rng) => { const ok = WALL_ORDERS.filter((o) => available(b, o).ok); return ok[rng.int(ok.length)]!; }],
  ['push', pick('press')],
  ['brace', pick('brace')],
];

function fight(b: BattleState, play: Play, rng: RngCursor): BattleState {
  for (let g = 0; g < 20 && !b.over; g++) wallRound(b, play(b, rng), rng);
  return b;
}

interface Row { label: string; foe: string; ours: number; q: number; theirs: number; terrain: BattleTerrain; context: BattleState['context']; resolve?: Resolve; vet?: boolean }
const rows: Row[] = [
  { label: 'raid Iona (alert)', foe: 'monks_tenants', ours: 26, q: 0.6, theirs: 15, terrain: 'beach', context: 'raid' },
  { label: 'Bangor (warned)', foe: 'ulster_levy', ours: 40, q: 1, theirs: 30, terrain: 'field', context: 'scene' },
  { label: 'rival crew at sea', foe: 'rival_crew', ours: 26, q: 0.6, theirs: 20, terrain: 'ship', context: 'sea' },
  { label: 'even: rival crew', foe: 'rival_crew', ours: 30, q: 1, theirs: 30, terrain: 'beach', context: 'scene' },
  { label: 'even: as a levy', foe: 'rival_crew', ours: 30, q: 1, theirs: 30, terrain: 'beach', context: 'scene', resolve: 'levy' },
  { label: 'even: as a hird', foe: 'rival_crew', ours: 30, q: 1, theirs: 30, terrain: 'beach', context: 'scene', resolve: 'hird' },
  { label: 'even: veterans', foe: 'rival_crew', ours: 30, q: 1, theirs: 30, terrain: 'beach', context: 'scene', vet: true },
  { label: 'Franks 40 v 40', foe: 'frankish_levy', ours: 40, q: 1, theirs: 40, terrain: 'field', context: 'raid' },
];

const pct = (n: number) => `${Math.round(n * 100)}%`.padStart(4);
console.log(`measure-battle: ${N} battles per cell (read score 4)\n`);
console.log('scenario                   | play     | win  lost part | rounds | our losses | their losses | lord falls');
let rounds = 0;
for (const r of rows) {
  const base = content.foes[r.foe]!;
  const foe: Foe = r.vet ? { ...base, quality: Math.min(3, base.quality + 1), guile: Math.min(3, (base.guile ?? 0) + 1), resolve: 'hird' } : r.resolve ? { ...base, resolve: r.resolve } : base;
  for (const [pname, play] of plays) {
    const rng = new RngCursor(seedRng(42));
    let w = 0, l = 0, p = 0, rr = 0, ol = 0, tl = 0, lord = 0;
    for (let i = 0; i < N; i++) {
      const b = fight(battle(foe, r.ours, r.q, r.theirs, r.terrain, 'wall', r.context, 4, rng), play, rng);
      if (b.over === 'won') w++; else if (b.over === 'lost') l++; else p++;
      rr += b.round; ol += b.lost / r.ours; tl += b.killed / r.theirs; if (b.wall!.leaderDown) lord++;
    }
    rounds += rr;
    console.log(`${r.label.padEnd(26)} | ${pname.padEnd(8)} | ${pct(w / N)} ${pct(l / N)} ${pct(p / N)} | ${(rr / N).toFixed(1).padStart(6)} | ${pct(ol / N).padStart(10)} | ${pct(tl / N).padStart(12)} | ${pct(lord / N).padStart(10)}`);
  }
}

console.log('\nhero by position (Bangor, warned; instinct):');
console.log('position | win  | hero hit/battle | hero down');
for (const pos of ['front', 'wall', 'rear'] as Position[]) {
  const rng = new RngCursor(seedRng(7));
  let w = 0, hits = 0, down = 0;
  for (let i = 0; i < N; i++) {
    const b = fight(battle(content.foes.ulster_levy!, 40, 1, 30, 'field', pos, 'scene', 4, rng), plays[0]![1], rng);
    if (b.over === 'won') w++;
    hits += b.heroHits.length;
    if (b.heroDown) down++;
  }
  console.log(`${pos.padEnd(8)} | ${pct(w / N)} | ${(hits / N).toFixed(2).padStart(15)} | ${pct(down / N)}`);
}

console.log('\nreading them (Bangor, warned; instinct), by read score against guile 2:');
for (const score of [2, 4, 6, 8]) {
  const rng = new RngCursor(seedRng(9));
  let w = 0;
  for (let i = 0; i < N; i++) if (fight(battle(content.foes.ulster_levy!, 40, 1, 30, 'field', 'wall', 'scene', score, rng), plays[0]![1], rng).over === 'won') w++;
  console.log(`read ${score} | win ${pct(w / N)}`);
}
if (rounds === 0) {
  console.log('\nmeasure-battle: FAILED — no rounds were fought');
  process.exit(1);
}
