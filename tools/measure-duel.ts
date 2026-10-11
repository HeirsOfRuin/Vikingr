// Single-combat balance: win rates by fighter against fighter, exchanges, deaths.
// Usage: npm run measure:duel -- [--n 4000]
// Uses the same resolveExchange() as play (DESIGN §3, one code path rule).
import { loadContent } from './content-loader';
import type { DuelMove, Fighter } from '../src/content/schema';
import { DUEL_MOVES } from '../src/content/schema';
import { RngCursor, seedRng } from '../src/engine/rng';
import { adaptivePolicy, fightOut, habitPolicy, makeDuel, sideFromFighter, BEATS, type DuelPolicy } from '../src/engine/duel';

const args = process.argv.slice(2);
const N = Number(args[args.indexOf('--n') + 1] || 4000);
const content = loadContent();

// the hero at three points in a life, as fighters
const heroes: Fighter[] = [
  { id: 'hero16', name: 'Hero at 16', attrs: { str: 3, agi: 2, end: 2, wit: 2, pre: 2 }, weapons: 2, shield: 2, armour: 1, weapon: 2, habits: {}, desc: '' },
  { id: 'hero25', name: 'Hero at 25', attrs: { str: 3, agi: 3, end: 3, wit: 2, pre: 2 }, weapons: 5, shield: 4, armour: 2, weapon: 2, habits: {}, desc: '' },
  { id: 'hero35', name: 'Champion', attrs: { str: 4, agi: 3, end: 3, wit: 3, pre: 3 }, weapons: 7, shield: 6, armour: 2, weapon: 3, habits: {}, desc: '' },
];
const uniform: DuelPolicy = (_d, _s, rng) => DUEL_MOVES[rng.int(DUEL_MOVES.length)]!;

// sanity: the move cycle is balanced (each move beats as many as it loses to)
for (const m of DUEL_MOVES) {
  const beats = BEATS[m].length;
  const loses = DUEL_MOVES.filter((o) => BEATS[o].includes(m)).length;
  if (beats !== loses || beats * 2 !== DUEL_MOVES.length - 1) { console.log(`measure-duel: FAILED — ${m} beats ${beats}, loses to ${loses}`); process.exit(1); }
}

const pct = (n: number) => `${Math.round(n * 100)}%`.padStart(4);
console.log(`measure-duel: ${N} fights per cell (holmgang rules, fought to the end)\n`);
console.log('hero        | foe                 | policy   | win  lose part | exch | hero hits');
let exchanges = 0;
for (const h of heroes) {
  for (const f of Object.values(content.fighters)) {
    for (const [pn, pol] of [['instinct', adaptivePolicy], ['random', uniform]] as const) {
      const rng = new RngCursor(seedRng(11));
      let w = 0, l = 0, p = 0, ex = 0, hits = 0;
      for (let i = 0; i < N; i++) {
        const d = fightOut(makeDuel('holmgang', true, f.id, sideFromFighter(h, 'holmgang'), sideFromFighter(f, 'holmgang'), 0.04 * (h.attrs.wit + 1)), pol, rng);
        if (d.over === 'won' || d.over === 'foe_yielded') w++; else if (d.over === 'lost') l++; else p++;
        ex += d.exchange; hits += d.hero.hits.length;
      }
      exchanges += ex;
      console.log(`${h.name.padEnd(11)} | ${f.name.slice(0, 19).padEnd(19)} | ${pn.padEnd(8)} | ${pct(w / N)} ${pct(l / N)} ${pct(p / N)} | ${(ex / N).toFixed(1).padStart(4)} | ${(hits / N).toFixed(1).padStart(9)}`);
    }
  }
}
// reading the foe should be worth something: instinct with full reads vs none, hero at 16 against Thorgils
const f = content.fighters.thorgils!;
for (const read of [false, true]) {
  const rng = new RngCursor(seedRng(5));
  let w = 0;
  for (let i = 0; i < N; i++) {
    const d = makeDuel('holmgang', true, f.id, sideFromFighter(heroes[0]!, 'holmgang'), sideFromFighter(f, 'holmgang'), 0);
    if (read) d.read = [...DUEL_MOVES] as DuelMove[];
    fightOut(d, adaptivePolicy, rng);
    if (d.over === 'won' || d.over === 'foe_yielded') w++;
  }
  console.log(`\nhero at 16 v Thorgils, ${read ? 'fully read' : 'unread'}: win ${pct(w / N)}`);
}
void habitPolicy;
if (exchanges === 0) { console.log('measure-duel: FAILED — no exchanges'); process.exit(1); }
