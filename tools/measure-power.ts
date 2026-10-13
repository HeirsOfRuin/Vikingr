// The power curve (docs/FRAME-HARDSHIP.md): over long bot lives, silver, ships, men and fame should rise, level
// off and wobble, not climb without limit. Snapshots each spring; medians by year; the hardship counts.
import { loadContent } from './content-loader';
import { Bot, type Policy } from './bot-lib';
import { act, newGame } from '../src/engine/index';
import { RngCursor, seedRng } from '../src/engine/rng';
import { dateOf } from '../src/engine/calendar';
import { livingFame } from '../src/engine/fame';
import { aliveMen } from '../src/engine/crew';
import { ABLATE, SETBACK } from '../src/engine/hardship';
import type { GameState } from '../src/engine/state';

const content = loadContent();
const arg = (k: string, d: number) => Number(process.argv[process.argv.indexOf(k) + 1]) || d;
const runs = arg('--runs', 60);
const years = arg('--years', 20);
const off = process.argv.includes('--off') ? process.argv[process.argv.indexOf('--off') + 1]!.split(',') : [];
for (const k of off) ABLATE[k] = true;
if (off.length) console.log(`brakes off: ${off.join(', ')}`);
const policies = (process.argv.includes('--all') ? ['raider', 'reckless', 'coward'] : ['raider']) as Policy[];
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)]! : 0; };
const p90 = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length * 0.9)]! : 0; };
const marks = (o: number) => Math.round(o / 24);

for (const policy of policies) {
  const snaps: Record<number, { wealth: number[]; ships: number[]; men: number[]; fame: number[]; envy: number[]; upkeep: number[]; income: number[] }> = {};
  let bigFleetYears = 0, livesBig = 0, setbacks = 0, lifeYears = 0, deaths = 0;
  const kinds: Record<string, number> = {};
  for (let i = 0; i < runs; i++) {
    let s: GameState = newGame(content, { background: 'younger_son', seed: 7000 + i, name: 'Bot' });
    const bot = new Bot(policy, new RngCursor(seedRng((7000 + i) ^ 0x5bd1e995)));
    const start = dateOf(s.day).year;
    let lastYear = start;
    let steps = 0;
    let big = 0, wasBig = false;
    while (!s.death && dateOf(s.day).year < start + years && steps < 80000) {
      const a = bot.choose(s, content);
      if (!a) break;
      try { s = act(content, s, a); } catch { break; }
      steps++;
      const y = dateOf(s.day).year;
      if (y !== lastYear) {
        lastYear = y;
        const sn = (snaps[y] ??= { wealth: [], ships: [], men: [], fame: [], envy: [], upkeep: [], income: [] });
        sn.wealth.push(s.silver + s.base.hoard + s.loot);
        sn.ships.push(s.ships.length);
        sn.men.push(s.crew.men + aliveMen(s).length);
        sn.fame.push(livingFame(s));
        sn.envy.push(s.hard?.envy ?? 0);
        const ly = s.hard?.ledger?.[y - 1];
        if (ly && livingFame(s) >= 60) { sn.upkeep.push(ly.upkeep); sn.income.push(ly.income); }
        lifeYears++;
        if (s.ships.length > 8) { big++; if (big > 2) bigFleetYears++; wasBig = true; } else big = 0;
      }
    }
    if (s.death) deaths++;
    if (wasBig) livesBig++;
    for (const j of s.journal) {
      const m = SETBACK.exec(j.text);
      if (m) { if (m[1] !== 'coast') setbacks++; kinds[m[1]!] = (kinds[m[1]!] ?? 0) + 1; }
    }
  }
  console.log(`\n${policy}: ${runs} lives × ${years} years; ${deaths} died before the end`);
  console.log('  year   wealth(mk) p50/p90   ships p50/p90   men p50/p90   fame p50/p90   envy p50   upkeep share p50 (fame 60+)');
  for (const [y, v] of Object.entries(snaps).sort()) {
    const share = v.income.length ? median(v.upkeep.map((u, k) => u / Math.max(1, u + v.income[k]!))) : 0;
    console.log(`  ${y}   ${String(marks(median(v.wealth))).padStart(4)}/${String(marks(p90(v.wealth))).padEnd(5)}        ${median(v.ships)}/${p90(v.ships)}             ${String(median(v.men)).padStart(3)}/${String(p90(v.men)).padEnd(4)}      ${String(Math.round(median(v.fame))).padStart(3)}/${String(Math.round(p90(v.fame))).padEnd(4)}       ${median(v.envy).toFixed(1)}       ${Math.round(share * 100)}%  (${v.wealth.length})`);
  }
  console.log(`  lives that ever held more than 8 ships: ${livesBig}; years past the second with more than 8: ${bigFleetYears}`);
  console.log(`  setbacks: ${setbacks} in ${lifeYears} living years (one every ${(lifeYears / Math.max(1, setbacks)).toFixed(1)} years): ` + Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', '));
}
