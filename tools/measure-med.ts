// The Middle Sea, measured (docs/FRAME-MED.md targets): death, ships lost, pay, and how the fights go.
//   npx tsx tools/measure-med.ts [--runs=120]
import { loadContent } from './content-loader';
import { newGame, act } from '../src/engine/index';
import { dayOf } from '../src/engine/calendar';
import { Bot, type Policy } from './bot-lib';
import { RngCursor, seedRng } from '../src/engine/rng';
import { formatSilver } from '../src/engine/format';
import type { GameState } from '../src/engine/state';

const content = loadContent();
const runs = Number(process.argv.find((a) => a.startsWith('--runs='))?.slice(7) ?? 120);

function captain(seed: number, two: boolean): GameState {
  const s = newGame(content, { background: 'younger_son', seed, name: 'Ari', era: 843 });
  s.pending = null;
  s.service = null;
  s.ships = [{ id: 'one', type: 'karvi', name: 'the Hart', hull: 90 }];
  if (two) s.ships.push({ id: 'two', type: 'karvi', name: 'the Otter', hull: 90 });
  s.crew.men = two ? 50 : 28;
  for (const m of s.men) m.sworn = true;
  s.day = dayOf(859, 120);
  s.phase = 'sailing';
  s.at = 'noirmoutier';
  for (const p of ['noirmoutier', 'nantes']) if (!s.known.includes(p)) s.known.push(p);
  s.seen.mh_word_spring = s.day;
  return s;
}

const out = { home: 0, early: 0, dead: 0, stuck: 0, shipLost: 0, twoShip: 0 };
let pay = 0, payN = 0, menLost = 0;
const fights: Record<string, { won: number; parted: number; n: number }> = {};
for (let i = 0; i < runs; i++) {
  const two = i % 2 === 0;
  if (two) out.twoShip++;
  let s = captain(1000 + i, two);
  const bot = new Bot((['raider', 'reckless', 'random'] as Policy[])[i % 3]!, new RngCursor(seedRng(i * 7 + 1)));
  const start = s.loot + s.silver;
  const men0 = s.crew.men;
  for (let k = 0; k < 20 && !(s.pending?.t === 'scene' && s.pending.id === 'mh_council'); k++) s = act(content, s, bot.choose(s, content)!);
  s = act(content, s, { t: 'choose', id: 'go' });
  let end: keyof typeof out = 'stuck';
  for (let k = 0; k < 3000; k++) {
    if (s.death) { end = 'dead'; break; }
    if ((s.seen.mh_home || s.seen.mh_home_early) && !s.pending) { end = s.seen.mh_home ? 'home' : 'early'; break; }
    const p = s.pending;
    const before = p?.t === 'battle' ? p.battle : null;
    // the full voyage: these captains stay with the fleet at both leave windows (--leave lets the bot choose)
    const stay = !process.argv.includes('--leave') && p?.t === 'scene' && (p.id === 'mh_parting' || p.id === 'mh_winter2');
    s = act(content, s, stay ? { t: 'choose', id: p.id === 'mh_parting' ? 'on' : 'stay' } : bot.choose(s, content)!);
    if (before && s.pending?.t !== 'battle') {
      const key = before.host?.title ?? before.foeId;
      const f = (fights[key] ??= { won: 0, parted: 0, n: 0 });
      f.n++;
      if (before.over === 'won') f.won++;
      if (before.over === 'parted') f.parted++;
    }
  }
  out[end]++;
  if (two && s.ships.length < 2) out.shipLost++;
  if (end === 'home' || end === 'early') { pay += s.loot + s.silver - start; payN++; menLost += (men0 - s.crew.men) / men0; }
}
console.log(`the Middle Sea, ${runs} captains (half with two ships)`);
console.log(`  home with the fleet ${out.home}, home early ${out.early}, died ${out.dead} (${Math.round((out.dead / runs) * 100)}%), stuck ${out.stuck}`);
console.log(`  two-ship captains who lost a ship: ${out.shipLost} of ${out.twoShip}`);
console.log(`  share of his crew lost by those who came home: ${Math.round((menLost / Math.max(1, payN)) * 100)}%`);
console.log(`  heap and purse gained by those who came home: ${formatSilver(Math.round(pay / Math.max(1, payN)))} on average`);
for (const [k, f] of Object.entries(fights)) console.log(`  ${k}: ${f.n} fought, ${Math.round((f.won / f.n) * 100)}% won, ${Math.round((f.parted / f.n) * 100)}% both drew off`);
