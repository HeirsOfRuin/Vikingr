// The sea-jarldom and fort wardens (docs/DESIGN.md, 2026-11-13): how many bot lives reach a hall and three holdings,
// how many are named sea-jarl and when, and what wardens do to the forts. Raider policy, ambitious bot.
import { loadContent } from './content-loader';
import { Bot, BOT_OPTS } from './bot-lib';
import { act, newGame } from '../src/engine/index';
import { RngCursor, seedRng } from '../src/engine/rng';
import { dateOf } from '../src/engine/calendar';
import type { GameState } from '../src/engine/state';

const content = loadContent();
const arg = (k: string, d: number) => Number(process.argv[process.argv.indexOf(k) + 1]) || d;
const runs = arg('--runs', 100);
const years = arg('--years', 20);
BOT_OPTS.ambitious = !process.argv.includes('--plain');
let hall = 0, three = 0, named = 0, warded = 0, fortsLost = 0, wardTurned = 0, apart = 0, steps = 0, wards = 0, wardDied = 0;
const namedAt: number[] = [];
for (let i = 0; i < runs; i++) {
  let s: GameState = newGame(content, { background: 'younger_son', seed: 9100 + i, name: 'Bot' });
  const bot = new Bot('raider', new RngCursor(seedRng((9100 + i) ^ 0x5bd1e995)));
  const start = dateOf(s.day).year;
  let n = 0, sawHall = false, sawThree = false, sawWard = false;
  while (!s.death && dateOf(s.day).year < start + years && n < 120000) {
    const a = bot.choose(s, content);
    if (!a) break;
    try { s = act(content, s, a); } catch { break; }
    n++;
    if (s.base.level === 'hall') sawHall = true;
    if ((s.holdings ?? []).length >= 3) sawThree = true;
    if ((s.holdings ?? []).some((h) => h.warden)) sawWard = true;
  }
  steps += n;
  if (n < 50) throw new Error(`run ${i} made no progress`);
  if (sawHall) hall++;
  if (sawThree) three++;
  if (sawWard) warded++;
  const j = s.journal.map((x) => x.text).join('\n');
  const nm = s.deeds.find((d) => /named sea-jarl/.test(d.text));
  if (nm) { named++; namedAt.push(dateOf(nm.day).year - start); }
  fortsLost += (j.match(/Lost the ship-fort/g) ?? []).length;
  wardTurned += (j.match(/kept the fort at .* for himself/g) ?? []).length;
  wards += (j.match(/^Left .* to hold the fort at/gm) ?? []).length;
  wardDied += (j.match(/died holding the fort at/g) ?? []).length;
  if (/sea-jarldom came apart/.test(j)) apart++;
}
const med = (xs: number[]) => { const t = [...xs].sort((a, b) => a - b); return t.length ? t[Math.floor(t.length / 2)] : '-'; };
console.log(`raider${BOT_OPTS.ambitious ? ' (ambitious)' : ''}: ${runs} lives × ${years} years, ${Math.round(steps / runs)} steps a life`);
console.log(`  ever a hall: ${hall}; ever 3+ holdings: ${three}; named sea-jarl: ${named} (median year ${med(namedAt)} of the life); came apart: ${apart}`);
console.log(`  lives that left a warden: ${warded}; wardens left: ${wards}; who kept a fort for himself: ${wardTurned}; who died holding one: ${wardDied}; forts lost: ${fortsLost}`);
