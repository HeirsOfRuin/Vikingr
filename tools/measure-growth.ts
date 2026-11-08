// How fast the body and the mind grow by use (src/engine/hero.ts train; Josh, 2026-11-08).
// Plays raider and homebody lives for 3, 6 and 10 years and reports each attribute's gain over the start,
// Blood and Breath at the end, and how many lived.
// Usage: npx tsx tools/measure-growth.ts [--runs 30]
import { loadContent } from './content-loader';
import { playLife, type Policy } from './bot-lib';
import { ATTRS } from '../src/content/schema';
import { hpMax, breathMax, ATTR_GROWTH } from '../src/engine/hero';

const args = process.argv.slice(2);
const runs = Number(args[args.indexOf('--runs') + 1] ?? 30) || 30;
const content = loadContent();
// --rate N tries another xp per point (0: no growth, for a baseline)
if (args.includes('--rate')) (ATTR_GROWTH as { perLevel: number }).perLevel = Number(args[args.indexOf('--rate') + 1]) || 1e9;
console.log(`perLevel ${ATTR_GROWTH.perLevel}`);
const r1 = (n: number) => Math.round(n * 10) / 10;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

for (const policy of (args.includes('--raider') ? ['raider'] : ['raider', 'homebody']) as Policy[]) {
  console.log(`\n${policy}: ${runs} lives × 3 backgrounds`);
  console.log('years | alive | gain: str  agi  end  wit  pre | end at 6+ | blood breath (alive)');
  for (const years of [3, 6, 10]) {
    const res = [];
    for (const bg of ['younger_son', 'outlaw', 'freedman']) for (let i = 0; i < runs; i++) {
      const r = playLife(content, policy, 2000 + i, years, bg);
      if (r.error) continue;
      const start = content.backgrounds[bg]!.attrs;
      res.push({ r, gain: Object.fromEntries(ATTRS.map((a) => [a, r.state.hero.attrs[a] - start[a]])) as Record<string, number> });
    }
    const alive = res.filter((x) => !x.r.state.death);
    const gain = ATTRS.map((a) => r1(avg(alive.map((x) => x.gain[a]!))).toFixed(1).padStart(4)).join(' ');
    const top = alive.filter((x) => x.r.state.hero.attrs.end >= 6).length;
    const blood = r1(avg(alive.map((x) => hpMax(x.r.state, content))));
    const breath = r1(avg(alive.map((x) => breathMax(x.r.state, content))));
    console.log(`${String(years).padStart(5)} | ${String(Math.round((100 * alive.length) / Math.max(1, res.length))).padStart(4)}% |       ${gain} | ${String(top).padStart(9)} | ${String(blood).padStart(5)} ${String(breath).padStart(6)}`);
  }
}
