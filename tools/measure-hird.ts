// The hird and hostages (docs/FRAME-HIRD-HOSTAGES.md): over long bot lives, how many sworn men a lord keeps,
// where they come from, and what becomes of the hostages he takes.
import { loadContent } from './content-loader';
import { Bot, type Policy } from './bot-lib';
import { act, newGame } from '../src/engine/index';
import { RngCursor, seedRng } from '../src/engine/rng';
import { dateOf } from '../src/engine/calendar';
import { hirdCount } from '../src/engine/hird';
import type { GameState } from '../src/engine/state';

const content = loadContent();
const arg = (k: string, d: number) => Number(process.argv[process.argv.indexOf(k) + 1]) || d;
const runs = arg('--runs', 60);
const years = arg('--years', 16);
const policy = (process.argv.includes('--policy') ? process.argv[process.argv.indexOf('--policy') + 1] : 'raider') as Policy;
const bgs = ['younger_son', 'freedman', 'outlaw'];
// --lord: in the spring of 834 the life is given a hall, three pounds of silver and four rings, to see the hird grow where it can
const lord = process.argv.includes('--lord');
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)]! : 0; };
const p90 = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length * 0.9)]! : 0; };

const at: Record<number, { sworn: number[]; hall: number; own: number[] }> = {};
const origins: Record<string, number> = {};
const ends: Record<string, number> = {};
let taken = 0, walked = 0, lives = 0, capFirst: number[] = [];
let ransomSilver = 0, ransoms = 0, soldSilver = 0, sold = 0;
for (const bg of bgs) for (let i = 0; i < runs; i++) {
  let s: GameState = newGame(content, { background: bg, seed: 9100 + i, name: 'Bot' });
  const bot = new Bot(policy, new RngCursor(seedRng((9100 + i) ^ 0x2f6b1d3)));
  const start = dateOf(s.day).year;
  let last = start, steps = 0, capped = false;
  const seenH = new Set<string>();
  lives++;
  while (!s.death && dateOf(s.day).year < start + years && steps < 90000) {
    const a = bot.choose(s, content);
    if (!a) break;
    try { s = act(content, s, a); } catch { break; }
    steps++;
    for (const h of s.hostages ?? []) if (!seenH.has(h.id)) { seenH.add(h.id); taken++; }
    const y = dateOf(s.day).year;
    if (y !== last) {
      last = y;
      if (lord && y === 834 && !s.service) { s.base.level = 'hall'; s.silver += 144; s.rings = { silver: (s.rings?.silver ?? 0) + 4, gold: s.rings?.gold ?? 0 }; }
      (at[y] ??= { sworn: [], hall: 0, own: [] }).sworn.push(hirdCount(s));
      if (s.base.level !== 'father') at[y]!.own.push(hirdCount(s));
      if (s.base.level === 'hall') at[y]!.hall++;
      if (!capped && hirdCount(s) >= 15) { capped = true; capFirst.push(y); }
    }
  }
  for (const m of s.men) if (m.origin) origins[m.origin] = (origins[m.origin] ?? 0) + 1;
  for (const j of s.journal) {
    if (/went off to find a better lord/.test(j.text)) walked++;
    let m = /^Ransomed .* for (.*)\.$/.exec(j.text);
    if (m) { ransoms++; ends.ransomed = (ends.ransomed ?? 0) + 1; ransomSilver += parse(m[1]!); }
    m = /^Sold .* to the slave-trader for (.*)\.$/.exec(j.text);
    if (m) { sold++; ends.sold = (ends.sold ?? 0) + 1; soldSilver += parse(m[1]!); }
    if (/^Holds .* as surety/.test(j.text)) ends.surety = (ends.surety ?? 0) + 1;
    if (/died in your keeping/.test(j.text)) ends.died = (ends.died ?? 0) + 1;
    if (/ escaped\.$/.test(j.text)) ends.escaped = (ends.escaped ?? 0) + 1;
    if (/^Sent .* home without a ransom/.test(j.text)) ends.freed = (ends.freed ?? 0) + 1;
    if (/^Sent .* home, raised in your hall/.test(j.text)) ends.fostered = (ends.fostered ?? 0) + 1;
    if (/^Married .* her kin went home/.test(j.text)) ends.married = (ends.married ?? 0) + 1;
    if (/^Handed .* to the jarl/.test(j.text)) ends.handed = (ends.handed ?? 0) + 1;
  }
}
function parse(t: string): number {
  // "3 pounds 40 coins", "40 coins", "2 pounds": pounds of 48 ørtugar, coins of a fifth of one
  const lb = /(\d+) pounds?/.exec(t), c = /(\d+) coins?/.exec(t);
  return (lb ? Number(lb[1]) * 48 : 0) + (c ? Number(c[1]) / 5 : 0);
}

console.log(`measure-hird: ${lives} lives (${bgs.join(', ')}), policy ${policy}, ${years} years${lord ? ', given a hall in 834' : ''}`);
console.log('year  sworn men: median  p90   (lives with a hall)   with a farm or hall: n, median, p90');
for (const y of Object.keys(at).map(Number).sort()) {
  const r = at[y]!;
  if (r.sworn.length < lives / 4) continue;
  console.log(`${y}  ${String(median(r.sworn)).padStart(6)} ${String(p90(r.sworn)).padStart(5)}   (${r.hall}/${r.sworn.length})   ${r.own.length}, ${median(r.own)}, ${p90(r.own)}`);
}
console.log(`new men alive at the end, by origin: ${JSON.stringify(origins)}`);
console.log(`new men who walked: ${walked}; lives reaching the cap of 15: ${capFirst.length}${capFirst.length ? `, first in ${Math.min(...capFirst)}` : ''}`);
console.log(`hostage parties taken: ${taken} (${(taken / lives).toFixed(2)} a life)`);
console.log(`what became of them: ${JSON.stringify(ends)}`);
if (ransoms) console.log(`ransom: ${ransoms}, average ${Math.round(ransomSilver / ransoms)} ø`);
if (sold) console.log(`sold: ${sold}, average ${Math.round(soldSilver / sold)} ø`);
