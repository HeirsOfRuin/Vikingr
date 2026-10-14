// The year 830 across many lives (FRAME-PHASE2 §7): how often Ásgeir falls, how often the hero takes
// command, which names the hall gives, who dies, and what the summer is worth in silver.
import { loadContent } from './content-loader';
import { playLife, POLICIES, type Policy } from './bot-lib';
import { formatSilver } from '../src/engine/format';
import { fameRank, livingFame } from '../src/engine/fame';

const content = loadContent();
const runs = Number(process.argv[process.argv.indexOf('--runs') + 1]) || 300;
const bg = process.argv.includes('--bg') ? process.argv[process.argv.indexOf('--bg') + 1]! : 'younger_son';
const pct = (n: number, d: number) => `${Math.round((100 * n) / Math.max(1, d))}%`;

for (const policy of POLICIES.filter((p) => p !== 'homebody') as Policy[]) {
  let alive = 0, fell = 0, command = 0, steinarr = 0, iona = 0, first = 0, holm = 0, ship831 = 0;
  const names: Record<string, number> = {};
  const deaths: Record<string, number> = {};
  const menDead: Record<string, number> = {};
  const silver: number[] = [];
  const fame: number[] = [];
  const rank: number[] = [];
  for (let i = 0; i < runs; i++) {
    // through spring 831: the year's choices are made once the spring scene has been answered
    const r = playLife(content, policy, 5000 + i, 2, bg, (s) => (bg === 'outlaw' ? s.seen.o_spring_831 !== undefined : s.seen.sp_831 !== undefined) && !s.pending);
    const s = r.state;
    if (r.error) { console.log(`  ERROR ${policy} ${5000 + i}: ${r.error}`); continue; }
    if (s.death) { deaths[s.death.cause] = (deaths[s.death.cause] ?? 0) + 1; continue; }
    alive++;
    if (s.fates.asgeir_falls) fell++;
    if (s.flags.bg_acclaimed) command++;
    if (s.flags.bg_steinarr) steinarr++;
    if (s.seen.i_approach !== undefined) iona++;
    if (s.flags.i_first) first++;
    if (s.flags.y_holm_won || s.flags.y_holm_lost) holm++;
    if (!s.service) ship831++;
    names[s.hero.nickname ?? '(none)'] = (names[s.hero.nickname ?? '(none)'] ?? 0) + 1;
    for (const m of s.men) if (!m.alive) menDead[m.id] = (menDead[m.id] ?? 0) + 1;
    silver.push(s.silver);
    fame.push(livingFame(s));
    rank.push(fameRank(s, content));
  }
  silver.sort((a, b) => a - b);
  fame.sort((a, b) => a - b);
  rank.sort((a, b) => a - b);
  console.log(`\n${policy}: ${runs} lives of ${bg}, through to spring 831`);
  console.log(`  alive at spring 831: ${pct(alive, runs)}   deaths: ${Object.entries(deaths).map(([k, v]) => `${k} ${pct(v, runs)}`).join(', ') || 'none'}`);
  console.log(`  Ásgeir's fate on him: ${pct(fell, alive)}   chosen by the men at Bangor: ${pct(command, alive)}   Steinarr took her: ${pct(steinarr, alive)}`);
  console.log(`  went to Iona: ${pct(iona, alive)}   first through the gate: ${pct(first, alive)}   holmgang fought: ${pct(holm, alive)}   a ship of his own in 831: ${pct(ship831, alive)}`);
  console.log(`  sworn men dead: ${Object.entries(menDead).map(([k, v]) => `${k} ${pct(v, alive)}`).join(', ') || 'none'}`);
  console.log(`  silver at spring 831: median ${formatSilver(silver[Math.floor(silver.length / 2)] ?? 0)}, 10th ${formatSilver(silver[Math.floor(silver.length * 0.1)] ?? 0)}, 90th ${formatSilver(silver[Math.floor(silver.length * 0.9)] ?? 0)}`);
  console.log(`  fame at spring 831: median ${Math.round(fame[Math.floor(fame.length / 2)] ?? 0)}, 90th ${Math.round(fame[Math.floor(fame.length * 0.9)] ?? 0)}; rank among the legends: median ${rank[Math.floor(rank.length / 2)] ?? 0}, best tenth ${rank[Math.floor(rank.length * 0.1)] ?? 0}`);
  console.log(`  names: ${Object.entries(names).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v, alive)}`).join(', ')}`);
}
