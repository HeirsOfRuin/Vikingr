// Play beyond the written story (FRAME-FOUNDATION §5): ten-year lives, counting the scenes they meet each year
// after spring 832, which repeatable events fire, who marries whom, the land they hold, and the boasts kept.
import { loadContent } from './content-loader';
import { Bot, type Policy } from './bot-lib';
import { act, newGame } from '../src/engine/index';
import { RngCursor, seedRng } from '../src/engine/rng';
import { dateOf } from '../src/engine/calendar';
import type { GameState } from '../src/engine/state';

const content = loadContent();
const arg = (k: string, d: number) => Number(process.argv[process.argv.indexOf(k) + 1]) || d;
const runs = arg('--runs', 100);
const years = arg('--years', 10);
const pct = (n: number, d: number) => `${Math.round((100 * n) / Math.max(1, d))}%`;
let failed = false;

for (const policy of ['raider', 'coward', 'reckless'] as Policy[]) {
  const fired: Record<string, number> = {};
  const perYear: Record<number, { scenes: number; lives: number }> = {};
  const wives: Record<string, number> = {};
  const base: Record<string, number> = {};
  let kept = 0, broken = 0, sworn = 0, lives832 = 0, children = 0;
  const byBoast: Record<string, [number, number]> = {};
  for (let i = 0; i < runs; i++) {
    let s: GameState = newGame(content, { background: 'younger_son', seed: 9000 + i, name: 'Bot' });
    const bot = new Bot(policy, new RngCursor(seedRng((9000 + i) ^ 0x5bd1e995)));
    const start = dateOf(s.day).year;
    let lastScene: string | null = null;
    const yearsSeen = new Set<number>();
    let steps = 0;
    while (!s.death && dateOf(s.day).year < start + years && steps < 40000) {
      const a = bot.choose(s, content);
      if (!a) { console.log(`  DEAD END ${policy} ${9000 + i} on day ${s.day}`); failed = true; break; }
      try { s = act(content, s, a); } catch (e) { console.log(`  ERROR ${policy} ${9000 + i}: ${(e as Error).message}`); failed = true; break; }
      steps++;
      const y = dateOf(s.day).year;
      if (y >= 833) yearsSeen.add(y);
      const id = s.pending?.t === 'scene' ? s.pending.id : null;
      if (id && id !== lastScene) {
        if (id.startsWith('g_')) fired[id] = (fired[id] ?? 0) + 1;
        if (y >= 833) (perYear[y] ??= { scenes: 0, lives: 0 }).scenes++;
      }
      lastScene = id;
    }
    for (const y of yearsSeen) (perYear[y] ??= { scenes: 0, lives: 0 }).lives++;
    if (s.seen.sp_832 === undefined) continue;
    lives832++;
    wives[s.base.wife ?? '(none)'] = (wives[s.base.wife ?? '(none)'] ?? 0) + 1;
    base[s.base.level] = (base[s.base.level] ?? 0) + 1;
    if (s.flags.child_son) children++;
    for (const b of s.boasts) if (b.id.startsWith('yule_')) {
      sworn++;
      if (b.state === 'kept') kept++;
      if (b.state === 'broken') broken++;
      const t = (byBoast[b.id] ??= [0, 0]);
      if (b.state === 'kept') t[0]++;
      if (b.state === 'broken') t[1]++;
    }
  }
  console.log(`\n${policy}: ${runs} lives × ${years} years; ${lives832} reached spring 832`);
  console.log('  scenes met per living year after 832: ' + Object.entries(perYear).sort().map(([y, v]) => `${y} ${(v.scenes / Math.max(1, v.lives)).toFixed(1)} (${v.lives})`).join(', '));
  console.log('  wives: ' + Object.entries(wives).map(([k, v]) => `${k} ${pct(v, lives832)}`).join(', ') + `; a son ${pct(children, lives832)}`);
  console.log('  land: ' + Object.entries(base).map(([k, v]) => `${k} ${pct(v, lives832)}`).join(', '));
  console.log(`  Yule boasts on the books at the end: ${sworn} (kept ${kept}, broken ${broken}); by boast, kept/broken: ` + Object.entries(byBoast).map(([k, [a, b]]) => `${k.slice(5)} ${a}/${b}`).join(', '));
  const never = Object.keys(content.scenes).filter((id) => id.startsWith('g_') && !fired[id]);
  console.log('  repeatable events: ' + Object.entries(fired).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
  if (never.length) console.log('  never fired: ' + never.join(', '));
}
if (failed) process.exit(1);
