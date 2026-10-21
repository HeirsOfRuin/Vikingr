// Family and the heir (docs/FRAME-LINEAGE.md B): births per married life, children alive at the father's death,
// how many lives go on as an heir, and how far the line runs. Raider lives from 830, up to --years (default 45).
import { loadContent } from './content-loader';
import { Bot, BOT_OPTS } from './bot-lib';
import { act, listActions, newGame } from '../src/engine/index';
import { RngCursor, seedRng } from '../src/engine/rng';
import { dateOf } from '../src/engine/calendar';
import { HEIR_ATTRS } from '../src/engine/makeup';
const c = loadContent();
BOT_OPTS.settle = true;
const era = process.argv.includes('--843') ? 843 : 830;
const runs = Number(process.argv.find((a) => a.startsWith('--runs='))?.slice(7) ?? 40);
const years = Number(process.argv.find((a) => a.startsWith('--years='))?.slice(8) ?? 45);
let settled = 0, lostHome = 0, iceland = 0, musterHome = 0, musterHomeN = 0, musterSettled = 0, musterSettledN = 0;
let married = 0, births = 0, aliveAtDeath = 0, deaths = 0, heirs = 0, gens = 0, skipped = 0;
const deathYears: number[] = [];
for (let i = 0; i < runs; i++) {
  let s = newGame(c, { background: (['younger_son', 'outlaw', 'freedman'] as const)[i % 3]!, seed: 7300 + i, name: 'B', era });
  const bot = new Bot('raider', new RngCursor(seedRng((7300 + i) ^ 0x5bd1e995)));
  let steps = 0, wasMarried = false;
  let wasSettled = false, lastYear = 0;
  while (dateOf(s.day).year < 830 + years && steps < 120000) {
    if (s.base.wife) wasMarried = true;
    if (s.homeAt && s.homeAt !== 'home_fjord' && !wasSettled) { wasSettled = true; settled++; if (s.homeAt === 'island' || s.homeAt === 'breidafjordr') iceland++; }
    if (wasSettled && !s.homeAt) { lostHome++; wasSettled = false; }
    const yy = dateOf(s.day).year;
    if (yy !== lastYear && s.phase === 'muster') { lastYear = yy; if (s.homeAt && s.homeAt !== 'home_fjord') { musterSettled += s.musterPool; musterSettledN++; } else { musterHome += s.musterPool; musterHomeN++; } }
    if (s.death) {
      deaths++;
      deathYears.push(dateOf(s.death.day).year);
      const own = (s.family?.children ?? []).filter((x) => x.father === s.hero.name);
      births += own.length;
      aliveAtDeath += own.filter((x) => x.alive).length;
      if (wasMarried) married++;
      wasMarried = false;
      const go = listActions(s, c)[0];
      if (!go) break;
      const before = dateOf(s.day).year;
      s = act(c, s, go.action);
      skipped += dateOf(s.day).year - before;
      s = act(c, s, { t: 'continue' });
      s = act(c, s, { t: 'heir_make', attrs: { ...HEIR_ATTRS }, set: 'sword' });
      heirs++;
      continue;
    }
    const a = bot.choose(s, c);
    if (!a) break;
    try { s = act(c, s, a); } catch { break; }
    steps++;
  }
  gens += 1 + (s.family?.line.length ?? 0);
}
const avg = (n: number, d: number) => (d ? (n / d).toFixed(2) : '-');
console.log(`${runs} raider lines from 830, up to ${years} years`);
console.log(`deaths ${deaths}; married at death ${married}`);
console.log(`children born per married life ${avg(births, married)}; alive at his death ${avg(aliveAtDeath, married)}`);
console.log(`went on as an heir ${heirs} of ${deaths} deaths (${Math.round((100 * heirs) / Math.max(1, deaths))}%); years passed in the skip, per heir ${avg(skipped, heirs)}`);
console.log(`settled abroad: ${settled} lines (in Iceland ${iceland}); homes lost to an attack ${lostHome}`);
console.log(`spring muster pool: at home in Hordaland ${avg(musterHome, musterHomeN)}, settled abroad ${avg(musterSettled, musterSettledN)}`);
console.log(`generations per line ${avg(gens, runs)}; death years median ${deathYears.sort((a, b) => a - b)[Math.floor(deathYears.length / 2)] ?? '-'}`);
