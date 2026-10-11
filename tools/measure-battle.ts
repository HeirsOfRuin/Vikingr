// Shield-wall balance: win rates, losses and the hero's risk by position, over many battles.
// Usage: npm run measure:battle -- [--n 2000]
// Uses the same resolveRound() as play (DESIGN §3, one code path rule).
import { loadContent } from './content-loader';
import type { BattleState, Position } from '../src/engine/state';
import type { BattleTerrain } from '../src/content/schema';
import { ORDERS } from '../src/content/schema';
import { RngCursor, seedRng } from '../src/engine/rng';
import { adaptivePolicy, doctrinePolicy, fightOutBattle, type BattlePolicy } from '../src/engine/battle';

const args = process.argv.slice(2);
const N = Number(args[args.indexOf('--n') + 1] || 2000);
const content = loadContent();

function battle(foe: string, ours: number, q: number, theirs: number, terrain: BattleTerrain, position: Position, context: BattleState['context']): BattleState {
  const f = content.foes[foe]!;
  return {
    foeId: foe, terrain, position, round: 0, log: [], heroDown: false, heroHp: 16, heroHpMax: 16, heroArmour: 1, heroHits: [],
    named: [{ id: 'a', name: 'A', slot: 'front', weapons: 3, down: false, hurt: false }, { id: 'b', name: 'B', slot: 'wall', weapons: 3, down: false, hurt: false }],
    deeds: [], over: null, context, place: null, killed: 0, lost: 0,
    us: { name: 'us', men: ours, start: ours, quality: q, morale: 6, doctrine: {}, last: null },
    them: { name: f.name, men: theirs, start: theirs, quality: f.quality, morale: 6 + f.quality, doctrine: f.doctrine, last: null },
  };
}

const uniform: BattlePolicy = (b, side, rng) => {
  const ok = ORDERS.filter((o) => (o === 'flank' ? b.us.men >= b.them.men * 1.3 && !['ship', 'ford', 'rampart'].includes(b.terrain) : true));
  return ok[rng.int(ok.length)]!;
};

interface Row { label: string; foe: string; ours: number; q: number; theirs: number; terrain: BattleTerrain; context: BattleState['context'] }
const rows: Row[] = [
  { label: 'raid Iona (surprised)', foe: 'monks_tenants', ours: 26, q: 0.6, theirs: 7, terrain: 'beach', context: 'raid' },
  { label: 'raid Iona (alert)', foe: 'monks_tenants', ours: 26, q: 0.6, theirs: 15, terrain: 'beach', context: 'raid' },
  { label: 'raid Bangor (surprised)', foe: 'ulster_levy', ours: 26, q: 0.6, theirs: 15, terrain: 'field', context: 'raid' },
  { label: 'raid Bangor (alert)', foe: 'ulster_levy', ours: 26, q: 0.6, theirs: 29, terrain: 'field', context: 'raid' },
  { label: 'rival crew at sea', foe: 'rival_crew', ours: 26, q: 0.6, theirs: 20, terrain: 'ship', context: 'sea' },
  { label: 'even: rival crew', foe: 'rival_crew', ours: 30, q: 1, theirs: 30, terrain: 'beach', context: 'scene' },
  { label: 'veterans 40 v levy 40', foe: 'ulster_levy', ours: 40, q: 2, theirs: 40, terrain: 'field', context: 'scene' },
];

const pct = (n: number) => `${Math.round(n * 100)}%`.padStart(4);
console.log(`measure-battle: ${N} battles per cell\n`);
console.log('scenario                   | policy   | win  lost part | rounds | our losses | their losses');
let rounds = 0;
for (const r of rows) {
  for (const [pname, pol] of [['adaptive', adaptivePolicy], ['doctrine', doctrinePolicy], ['uniform', uniform]] as const) {
    const rng = new RngCursor(seedRng(42));
    let w = 0, l = 0, p = 0, rr = 0, ol = 0, tl = 0;
    for (let i = 0; i < N; i++) {
      const b = fightOutBattle(battle(r.foe, r.ours, r.q, r.theirs, r.terrain, 'wall', r.context), pol as BattlePolicy, rng);
      if (b.over === 'won') w++; else if (b.over === 'lost') l++; else p++;
      rr += b.round; ol += b.lost / r.ours; tl += b.killed / r.theirs;
    }
    rounds += rr;
    console.log(`${r.label.padEnd(26)} | ${pname.padEnd(8)} | ${pct(w / N)} ${pct(l / N)} ${pct(p / N)} | ${(rr / N).toFixed(1).padStart(6)} | ${pct(ol / N).padStart(10)} | ${pct(tl / N).padStart(12)}`);
  }
}

console.log('\nhero by position (raid Bangor, alert; adaptive):');
console.log('position | win  | hero hit/battle | hero down');
for (const pos of ['front', 'wall', 'rear'] as Position[]) {
  const rng = new RngCursor(seedRng(7));
  let w = 0, hits = 0, down = 0;
  for (let i = 0; i < N; i++) {
    const b = fightOutBattle(battle('ulster_levy', 26, 0.6, 29, 'field', pos, 'raid'), adaptivePolicy, rng);
    if (b.over === 'won') w++;
    hits += b.heroHits.length;
    if (b.heroDown) down++;
  }
  console.log(`${pos.padEnd(8)} | ${pct(w / N)} | ${(hits / N).toFixed(2).padStart(15)} | ${pct(down / N)}`);
}
if (rounds === 0) {
  console.log('\nmeasure-battle: FAILED — no rounds were fought');
  process.exit(1);
}
