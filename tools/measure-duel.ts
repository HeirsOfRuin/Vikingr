// Single-combat balance in the second form (docs/FRAME-COMBAT-2.md): win rates by fighter against fighter, by how
// the player fights: careful reading (the best answer to what he can see), instinct (which slips to a great blow),
// and random moves. Exchanges and deaths.
// Usage: npm run measure:duel -- [--n 2000]
// Uses the same boutExchange() as play (DESIGN §3, one code path rule).
import { loadContent } from './content-loader';
import type { Fighter } from '../src/content/schema';
import { RngCursor, seedRng } from '../src/engine/rng';
import { makeDuel, sideFromFighter } from '../src/engine/duel';
import { boutAuto, boutAvailable, boutExchange, BOUT_MOVES, fighterGuile, fightOutBout, startBout } from '../src/engine/bout';
import type { DuelState } from '../src/engine/state';

const args = process.argv.slice(2);
const N = Number(args[args.indexOf('--n') + 1] || 2000);
const content = loadContent();

// the hero at three points in a life, as fighters
const heroes: Fighter[] = [
  { id: 'hero16', name: 'Hero at 16', attrs: { str: 3, agi: 2, end: 2, wit: 2, pre: 2 }, weapons: 2, shield: 2, armour: 1, weapon: 2, habits: {}, desc: '' },
  { id: 'hero25', name: 'Hero at 25', attrs: { str: 3, agi: 3, end: 3, wit: 3, pre: 2 }, weapons: 5, shield: 4, armour: 2, weapon: 2, habits: {}, desc: '' },
  { id: 'hero35', name: 'Champion', attrs: { str: 4, agi: 3, end: 3, wit: 3, pre: 3 }, weapons: 7, shield: 6, armour: 2, weapon: 3, habits: {}, desc: '' },
];
const eye = [3, 6, 9];

type Play = 'reading' | 'instinct' | 'random';
function fight(h: Fighter, hi: number, f: Fighter, play: Play, rng: RngCursor): DuelState {
  const d = makeDuel('holmgang', true, f.id, sideFromFighter(h, 'holmgang'), sideFromFighter(f, 'holmgang'), 0);
  startBout(d, { readScore: eye[hi]!, guile: fighterGuile(f), adviser: null, unyielding: f.unyielding }, rng);
  if (play === 'instinct') { fightOutBout(d, rng, false); return d; }
  for (let g = 0; g < 40 && !d.over; g++) {
    const ok = BOUT_MOVES.filter((m) => boutAvailable(d, m).ok);
    boutExchange(d, play === 'reading' ? boutAuto(d) : ok[rng.int(ok.length)]!, rng);
  }
  return d;
}

const pct = (n: number) => `${Math.round(n * 100)}%`.padStart(4);
console.log(`measure-duel: ${N} fights per cell (holmgang rules, fought to the end, never yielding)\n`);
console.log('hero        | foe                 | guile | play     | win  lose part | exch');
let exchanges = 0;
heroes.forEach((h, hi) => {
  for (const f of Object.values(content.fighters)) {
    for (const play of ['reading', 'instinct', 'random'] as Play[]) {
      const rng = new RngCursor(seedRng(11));
      let w = 0, l = 0, p = 0, ex = 0;
      for (let i = 0; i < N; i++) {
        const d = fight(h, hi, f, play, rng);
        if (d.over === 'won' || d.over === 'foe_yielded') w++; else if (d.over === 'lost' || d.over === 'yielded') l++; else p++;
        ex += d.exchange;
      }
      exchanges += ex;
      console.log(`${h.name.padEnd(11)} | ${f.name.slice(0, 19).padEnd(19)} | ${String(fighterGuile(f)).padStart(5)} | ${play.padEnd(8)} | ${pct(w / N)} ${pct(l / N)} ${pct(p / N)} | ${(ex / N).toFixed(1).padStart(4)}`);
    }
  }
});
if (exchanges === 0) { console.log('measure-duel: FAILED — no exchanges'); process.exit(1); }
