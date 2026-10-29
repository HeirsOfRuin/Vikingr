// Golden lives (docs/FRAME-GAUNTLET.md, check 8): fixed lives, the same seeds every run, summed up year by year
// and compared with a stored baseline (tests/golden/lives.json). A change is not an error (most changes are
// meant); it is a list of what moved, so nothing moves without someone seeing it. --update-golden rewrites it.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ContentBundle } from '../../src/content/schema';
import { playLife, type Policy } from '../bot-lib';
import { dateOf } from '../../src/engine/calendar';
import { livingFame } from '../../src/engine/fame';

const FILE = join(import.meta.dirname, '..', '..', 'tests', 'golden', 'lives.json');
const LIVES: { era: 830 | 843 | 865; bg: string; policy: Policy; seed: number }[] = [
  { era: 830, bg: 'younger_son', policy: 'raider', seed: 101 }, { era: 830, bg: 'outlaw', policy: 'coward', seed: 102 },
  { era: 830, bg: 'freedman', policy: 'reckless', seed: 103 }, { era: 843, bg: 'younger_son', policy: 'raider', seed: 104 },
  { era: 843, bg: 'freedman', policy: 'coward', seed: 105 }, { era: 865, bg: 'outlaw', policy: 'raider', seed: 106 },
  { era: 865, bg: 'younger_son', policy: 'homebody', seed: 107 }, { era: 830, bg: 'younger_son', policy: 'homebody', seed: 108 },
];

type Year = { y: number; at: string; silver: number; men: number; fame: number; scenes: number; dead?: string };
function summarise(content: ContentBundle, l: (typeof LIVES)[number]): Year[] {
  const out: Year[] = [];
  let last = -1;
  const r = playLife(content, l.policy, l.seed, 8, l.bg, (s) => {
    const y = dateOf(s.day).year;
    if (y !== last) { last = y; out.push({ y, at: s.at ?? 'sea', silver: s.silver + s.base.hoard, men: s.crew.men, fame: Math.round(livingFame(s)), scenes: Object.keys(s.seen).length }); }
    return false;
  }, l.era === 830 ? undefined : { era: l.era });
  if (r.state.death) out.push({ y: dateOf(r.state.day).year, at: r.state.at ?? 'sea', silver: 0, men: 0, fame: Math.round(livingFame(r.state)), scenes: Object.keys(r.state.seen).length, dead: r.state.death.cause });
  return out;
}

export function golden(content: ContentBundle, update: boolean): { baseline: boolean; total: number; changed: string[] } {
  const now = LIVES.map((l) => ({ key: `${l.era} ${l.bg} ${l.policy} seed ${l.seed}`, years: summarise(content, l) }));
  if (update || !existsSync(FILE)) {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(now, null, 1));
    return { baseline: false, total: now.length, changed: [] };
  }
  const base = JSON.parse(readFileSync(FILE, 'utf8')) as typeof now;
  const changed: string[] = [];
  for (const life of now) {
    const was = base.find((b) => b.key === life.key);
    if (!was) { changed.push(`${life.key}: new`); continue; }
    const i = life.years.findIndex((y, k) => JSON.stringify(y) !== JSON.stringify(was.years[k]));
    if (i >= 0 || life.years.length !== was.years.length) {
      const k = i >= 0 ? i : Math.min(life.years.length, was.years.length);
      const a = was.years[k], b = life.years[k];
      changed.push(`${life.key}: first differs in ${b?.y ?? a?.y}: ${a ? `${a.at}, ${a.silver} silver, ${a.men} men, fame ${a.fame}${a.dead ? `, died (${a.dead})` : ''}` : 'nothing'} → ${b ? `${b.at}, ${b.silver} silver, ${b.men} men, fame ${b.fame}${b.dead ? `, died (${b.dead})` : ''}` : 'nothing'}`);
    }
  }
  return { baseline: true, total: now.length, changed };
}
