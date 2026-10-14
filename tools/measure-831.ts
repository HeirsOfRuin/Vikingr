// The year 831 across many lives (docs/FRAME-831.md): which of the new places are reached, what happens
// at Conaille, at home and in winter, and whether every life gets through to the spring of 832.
import { loadContent } from './content-loader';
import { playLife, POLICIES, type Policy } from './bot-lib';
import { formatSilver } from '../src/engine/format';
import { tierAt, type Tier } from '../src/engine/standing';

const content = loadContent();
const runs = Number(process.argv[process.argv.indexOf('--runs') + 1]) || 200;
const bg = process.argv.includes('--bg') ? process.argv[process.argv.indexOf('--bg') + 1]! : 'younger_son';
const pct = (n: number, d: number) => `${Math.round((100 * n) / Math.max(1, d))}%`;
let failed = false;

for (const policy of POLICIES.filter((p) => p !== 'homebody') as Policy[]) {
  const n: Record<string, number> = {};
  const inc = (k: string, c = true) => { if (c) n[k] = (n[k] ?? 0) + 1; };
  const deaths: Record<string, number> = {};
  const silver: number[] = [];
  const tiers: Record<string, Record<Tier, number>> = {};
  let alive = 0;
  for (let i = 0; i < runs; i++) {
    const r = playLife(content, policy, 7000 + i, 3, bg, (s) => s.seen.sp_832 !== undefined && !s.pending);
    const s = r.state;
    if (r.error) { console.log(`  ERROR ${policy} ${7000 + i}: ${r.error}`); failed = true; continue; }
    if (s.death) { deaths[s.death.cause] = (deaths[s.death.cause] ?? 0) + 1; continue; }
    alive++;
    inc('spring832', s.seen.sp_832 !== undefined);
    inc('captain', !s.service);
    for (const [k, id] of [['kaupang', 'k_market'], ['lindisfarne', 'l_approach'], ['skye', 'sk_kolbeinn'], ['conaille', 'c_approach'], ['birsay', 'o_831_ingibjorg'], ['iona', 'i_831_colman']] as const) inc(k, s.seen[id] !== undefined);
    inc('king', !!s.flags.c_king_taken);
    inc('king_killed', !!s.flags.c_king_killed);
    inc('married', !!s.flags.married_gyda || !!s.flags.gyda_eloped);
    inc('brother', !!s.flags.brother_fought);
    inc('hrapp', !!s.flags.hrapp_fought || !!s.flags.hrapp_outlawed || !!s.flags.hrapp_paid || !!s.flags.hrapp_unpunished);
    inc('mail', !!s.flags.mail);
    inc('yule', s.seen.w1_yule !== undefined);
    silver.push(s.silver);
    for (const id of ['orkney', 'shetland', 'skye', 'kaupang', 'iona', 'bangor', 'conaille', 'lindisfarne']) {
      tiers[id] ??= { hostile: 0, unfriendly: 0, wary: 0, friendly: 0, allied: 0 };
      tiers[id]![tierAt(s, content, id)] += 1;
    }
  }
  silver.sort((a, b) => a - b);
  console.log(`\n${policy}: ${runs} lives of ${bg}, through to spring 832`);
  console.log(`  alive: ${pct(alive, runs)}   deaths: ${Object.entries(deaths).map(([k, v]) => `${k} ${pct(v, runs)}`).join(', ') || 'none'}   reached the spring 832 scene: ${pct(n.spring832 ?? 0, alive)}   a captain by then: ${pct(n.captain ?? 0, alive)}`);
  console.log(`  new places: Kaupang ${pct(n.kaupang ?? 0, alive)}, Lindisfarne ${pct(n.lindisfarne ?? 0, alive)}, Skye ${pct(n.skye ?? 0, alive)}, Conaille ${pct(n.conaille ?? 0, alive)}   revisits: Birsay ${pct(n.birsay ?? 0, alive)}, Iona ${pct(n.iona ?? 0, alive)}`);
  console.log(`  the king taken: ${pct(n.king ?? 0, alive)}, killed: ${pct(n.king_killed ?? 0, alive)}   married Gyda: ${pct(n.married ?? 0, alive)}   brother fight: ${pct(n.brother ?? 0, alive)}   Hrappssons: ${pct(n.hrapp ?? 0, alive)}   Yule 831: ${pct(n.yule ?? 0, alive)}   mail: ${pct(n.mail ?? 0, alive)}`);
  console.log(`  standing at spring 832 (hostile/unfriendly/wary/friendly/allied): ${Object.entries(tiers).map(([id, t]) => `${id} ${pct(t.hostile, alive)}/${pct(t.unfriendly, alive)}/${pct(t.wary, alive)}/${pct(t.friendly, alive)}/${pct(t.allied, alive)}`).join(', ')}`);
  console.log(`  silver at spring 832: median ${formatSilver(silver[Math.floor(silver.length / 2)] ?? 0)}, 10th ${formatSilver(silver[Math.floor(silver.length * 0.1)] ?? 0)}, 90th ${formatSilver(silver[Math.floor(silver.length * 0.9)] ?? 0)}`);
}
if (failed) process.exit(1);
