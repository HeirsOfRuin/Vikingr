import { loadContent } from './content-loader';
import { playLife } from './bot-lib';
const content = loadContent();
for (const policy of ['raider', 'coward'] as const) {
  let hunger = 0, dead = 0, fame = 0, n = 0, errs = 0;
  for (const bg of ['younger_son', 'freedman', 'outlaw']) for (let i = 0; i < 40; i++) {
    const r = playLife(content, policy, 4000 + i, 8, bg);
    n++; hunger += r.state.stats.hungerDays; if (r.state.death) dead++; if (r.error) errs++;
  }
  console.log(policy, 'lives', n, 'hunger days/life', (hunger / n).toFixed(1), 'dead', dead, 'errors', errs);
}
