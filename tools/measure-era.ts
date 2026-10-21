// Ragnarr's days (docs/FRAME-LINEAGE.md D): 843 lives against 830 lives, the same seeds and policies, 10 years.
import { loadContent } from './content-loader';
import { playLife, type Policy } from './bot-lib';
import { lastingFame, livingFame } from '../src/engine/fame';
const c = loadContent();
const runs = Number(process.argv.find((a) => a.startsWith('--runs='))?.slice(7) ?? 30);
const years = Number(process.argv.find((a) => a.startsWith('--years='))?.slice(8) ?? 10);
const policies: Policy[] = ['raider', 'coward'];
console.log(`${runs} lives per beginning × ${policies.join(', ')}, ${years} years`);
for (const era of [830, 843] as const) {
  const cells: string[] = [];
  for (const p of policies) {
    let alive = 0, fame = 0, plunder = 0, ships = 0, n = 0, errs = 0;
    for (const bg of ['younger_son', 'outlaw', 'freedman']) for (let i = 0; i < runs; i++) {
      const r = playLife(c, p, 6100 + i, years, bg, undefined, { era });
      n++;
      if (r.error) errs++;
      if (!r.state.death) alive++;
      fame += Math.max(livingFame(r.state), lastingFame(r.state));
      plunder += r.state.stats.plunder;
      ships += r.state.ships.length;
    }
    cells.push(`${p.padEnd(7)} alive ${String(Math.round((100 * alive) / n)).padStart(3)}%  fame ${(fame / n).toFixed(0).padStart(4)}  plunder ${(plunder / n / 240).toFixed(0).padStart(4)} lb  ships ${(ships / n).toFixed(1)}${errs ? `  ERRORS ${errs}` : ''}`);
  }
  console.log(`${era}  ${cells.join(' | ')}`);
}
