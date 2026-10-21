// Character creation (docs/FRAME-LINEAGE.md A): is any skill set, or any spread, dominant?
// For each beginning and set: 40 raider and 40 coward lives of 10 years. Survival, lasting fame, plunder.
// Then a few lopsided spreads on the younger son's first set.
import { loadContent } from './content-loader';
import { playLife, type Policy } from './bot-lib';
import { lastingFame } from '../src/engine/fame';
import type { Attr } from '../src/content/schema';
const c = loadContent();
const runs = Number(process.argv.find((a) => a.startsWith('--runs='))?.slice(7) ?? 40);
const years = Number(process.argv.find((a) => a.startsWith('--years='))?.slice(8) ?? 10);
const policies: Policy[] = ['raider', 'coward'];
const only = process.argv.find((a) => a.startsWith('--bg='))?.slice(5);
const noSpreads = process.argv.includes('--no-spreads');
function row(label: string, bg: string, make: { attrs?: Record<Attr, number>; skillSet?: string }) {
  const cells: string[] = [];
  for (const p of policies) {
    let alive = 0, fame = 0, plunder = 0;
    for (let i = 0; i < runs; i++) {
      const r = playLife(c, p, 4100 + i, years, bg, undefined, make);
      if (!r.state.death) alive++;
      fame += lastingFame(r.state);
      plunder += r.state.stats.plunder;
    }
    cells.push(`${p.padEnd(7)} alive ${String(Math.round((100 * alive) / runs)).padStart(3)}%  fame ${(fame / runs).toFixed(0).padStart(4)}  plunder ${(plunder / runs / 240).toFixed(0).padStart(4)} lb`);
  }
  console.log(`${label.padEnd(34)} ${cells.join(' | ')}`);
}
console.log(`${runs} lives × ${policies.join(', ')}, ${years} years\n`);
for (const bg of Object.values(c.backgrounds).filter((b) => !only || b.id === only)) for (const set of bg.skill_sets) row(`${bg.id} / ${set.id}`, bg.id, { skillSet: set.id });
if (noSpreads) process.exit(0);
console.log('\nspreads (younger son, raised to the sword)');
const only2 = process.argv.includes('--tough');
const spreads: Record<string, Record<Attr, number>> = only2 ? {
  'as born 3/2/2/2/2': { str: 3, agi: 2, end: 2, wit: 2, pre: 2 },
  'tough 1/2/5/1/1 (a 5 costs 6)': { str: 1, agi: 2, end: 5, wit: 1, pre: 1 },
  'tough 2/2/4/2/1': { str: 2, agi: 2, end: 4, wit: 2, pre: 1 },
} : {
  'as born 3/2/2/2/2': { str: 3, agi: 2, end: 2, wit: 2, pre: 2 },
  'brute 5/2/2/1/1': { str: 5, agi: 2, end: 2, wit: 1, pre: 1 },
  'tough 2/2/5/1/1': { str: 2, agi: 2, end: 5, wit: 1, pre: 1 },
  'sly 1/2/2/5/1': { str: 1, agi: 2, end: 2, wit: 5, pre: 1 },
  'chief 1/1/2/2/5': { str: 1, agi: 1, end: 2, wit: 2, pre: 5 },
};
for (const [k, a] of Object.entries(spreads)) row(k, 'younger_son', { attrs: a });
