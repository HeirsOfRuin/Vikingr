// Scouting (docs/FRAME-WORLD.md §A): the same lives, with and without "send men up to look".
// Raids tried and won, plunder, deaths. The careful bots scout first and walk away from a fight they can't win.
import { loadContent } from './content-loader';
import { BOT_OPTS, playLife, type Policy } from './bot-lib';
import { livingFame } from '../src/engine/fame';
import { ABLATE } from '../src/engine/hardship';

const content = loadContent();
const arg = (k: string, d: number) => Number(process.argv[process.argv.indexOf(k) + 1]) || d;
const runs = arg('--runs', 120);
const years = arg('--years', 8);

// scouting alone: the world without him held still (--world puts it back)
if (!process.argv.includes('--world')) ABLATE.chronicle = true;

function run(policy: Policy, scout: boolean) {
  BOT_OPTS.scout = scout;
  const causes: Record<string, number> = {};
  let tried = 0, won = 0, plunder = 0, alive = 0, battleDeaths = 0, scouted = 0, fame = 0;
  const fames: number[] = [];
  for (let i = 0; i < runs; i++) {
    const r = playLife(content, policy, 7000 + i, years);
    if (r.error) throw new Error(`${policy} ${7000 + i}: ${r.error}`);
    const s = r.state;
    tried += Object.values(s.places).reduce((n, p) => n + p.raided, 0);
    won += s.stats.raids;
    plunder += s.stats.plunder;
    if (!s.death) alive++;
    if (s.death?.cause === 'battle') battleDeaths++;
    if (s.death) causes[s.death.cause] = (causes[s.death.cause] ?? 0) + 1;
    scouted += Object.values(s.places).filter((p) => p.scout).length;
    fames.push(livingFame(s));
    fame += livingFame(s);
  }
  fames.sort((a, b) => a - b);
  const pct = (n: number) => `${Math.round((100 * n) / runs)}%`.padStart(4);
  console.log(`${policy.padEnd(8)} ${scout ? 'scouts ' : 'blind  '} raids tried ${(tried / runs).toFixed(1).padStart(5)}  won ${Math.round((100 * won) / Math.max(1, tried))}%  plunder ${Math.round(plunder / runs).toString().padStart(6)}  alive ${pct(alive)}  battle deaths ${pct(battleDeaths)}  median fame ${Math.round(fames[Math.floor(runs / 2)]!)}`);
  console.log(`${''.padEnd(16)} deaths: ${Object.entries(causes).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  void scouted; void fame;
}

console.log(`Scouting: ${runs} lives a row, ${years} years, the same seeds with and without\n`);
for (const p of ['raider', 'coward'] as Policy[]) {
  run(p, false);
  run(p, true);
}
