// Playthrough bot: plays lives with each policy and reports what happened.
// Usage: npm run bot -- [--runs 100] [--years 10] [--policy raider] [--background younger_son]
// Fails (exit 1) on dead ends, softlocks, or a run that did not actually play (failure mode #2).
import { loadContent } from './content-loader';
import { playLife, POLICIES, type Policy, type RunResult } from './bot-lib';
import { livingFame, lastingFame, fameRank } from '../src/engine/fame';
import { ageOn } from '../src/engine/calendar';
import { formatSilver } from '../src/engine/format';

const args = process.argv.slice(2);
const arg = (k: string, d: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1]! : d;
};
const runs = Number(arg('runs', '100'));
const years = Number(arg('years', '10'));
const policies = (arg('policy', '') ? [arg('policy', '')] : POLICIES) as Policy[];
const backgrounds = arg('background', '') ? [arg('background', '')] : ['younger_son', 'outlaw', 'freedman'];

const content = loadContent();
let failed = false;
const pct = (n: number, d: number) => `${d ? Math.round((100 * n) / d) : 0}%`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const r1 = (n: number) => Math.round(n * 10) / 10;

console.log(`bot: ${runs} runs × ${policies.length} policies × ${backgrounds.length} backgrounds, up to ${years} years each\n`);
console.log('policy    | yrs  | alive | dead: battle duel drowned straw | valhalla | fame  lasting rank | raids plunder/yr | battles won | storms hunger | steps/yr');
for (const policy of policies) {
  const results: RunResult[] = [];
  for (const bg of backgrounds) for (let i = 0; i < runs; i++) results.push(playLife(content, policy, 1000 + i, years, bg));
  const errs = results.filter((r) => r.error);
  for (const e of errs.slice(0, 5)) console.log(`  ERROR ${policy} seed ${e.seed}: ${e.error}`);
  if (errs.length) failed = true;
  const ok = results.filter((r) => !r.error);
  const dead = ok.filter((r) => r.state.death);
  const cause = (c: string) => dead.filter((r) => r.state.death!.cause === c).length;
  const yrs = avg(ok.map((r) => r.years));
  // progress assertion: lives that ended early must have ended in death, and the clock must have moved
  const stuck = ok.filter((r) => !r.state.death && r.years < years);
  if (stuck.length) {
    console.log(`  ERROR ${policy}: ${stuck.length} runs stopped before ${years} years without dying`);
    failed = true;
  }
  if (ok.length && yrs < 1) {
    console.log(`  ERROR ${policy}: average of ${r1(yrs)} years played — the bot is not playing`);
    failed = true;
  }
  const s = (f: (r: RunResult) => number) => r1(avg(ok.map(f)));
  console.log([
    policy.padEnd(9),
    String(r1(yrs)).padStart(4),
    pct(ok.length - dead.length, ok.length).padStart(5),
    `${pct(cause('battle'), ok.length).padStart(10)} ${pct(cause('duel'), ok.length).padStart(4)} ${pct(cause('drowned'), ok.length).padStart(7)} ${pct(cause('straw'), ok.length).padStart(5)}`,
    pct(dead.filter((r) => r.state.death!.afterlife === 'valhalla').length, ok.length).padStart(8),
    `${String(s((r) => livingFame(r.state))).padStart(5)} ${String(s((r) => lastingFame(r.state))).padStart(7)} ${String(s((r) => fameRank(r.state, content))).padStart(4)}`,
    `${String(s((r) => r.state.stats.raids)).padStart(5)} ${formatSilver(avg(ok.map((r) => r.state.stats.plunder / Math.max(1, r.years)))).padStart(12)}`,
    `${String(s((r) => r.state.stats.battles)).padStart(7)} ${pct(ok.reduce((a, r) => a + r.state.stats.battlesWon, 0), ok.reduce((a, r) => a + r.state.stats.battles, 0)).padStart(3)}`,
    `${String(s((r) => r.state.stats.storms)).padStart(6)} ${String(s((r) => r.state.stats.hungerDays)).padStart(6)}`,
    String(s((r) => r.steps / Math.max(1, r.years))).padStart(8),
  ].join(' | '));
  if (dead.length) {
    const ages = dead.map((r) => ageOn(r.state.death!.day));
    console.log(`          deaths at age ${Math.min(...ages)}–${Math.max(...ages)}, median ${ages.sort((a, b) => a - b)[Math.floor(ages.length / 2)]}`);
  }
}
if (failed) {
  console.log('\nbot: FAILED');
  process.exit(1);
}
console.log('\nbot: ok');
