// The world without him (docs/FRAME-WORLD.md §B-E): long lives, counting what the chronicle, the lords, the land
// and the seats did in them. And the A/B the frame promised: plunder with and without the legends at work.
import { loadContent } from './content-loader';
import { playLife, type Policy } from './bot-lib';
import { livingFame } from '../src/engine/fame';
import { ABLATE } from '../src/engine/hardship';
import type { GameState } from '../src/engine/state';

const content = loadContent();
const arg = (k: string, d: number) => Number(process.argv[process.argv.indexOf(k) + 1]) || d;
const runs = arg('--runs', 60);
const years = arg('--years', 16);
const pct = (n: number) => `${Math.round((100 * n) / runs)}%`;
const avg = (n: number) => (n / runs).toFixed(1);

function lives(policy: Policy, n: number, y: number): GameState[] {
  const out: GameState[] = [];
  for (let i = 0; i < n; i++) {
    const r = playLife(content, policy, 5000 + i, y);
    if (r.error) throw new Error(`${policy} ${5000 + i}: ${r.error}`);
    out.push(r.state);
  }
  return out;
}

if (!process.argv.includes('--no-ab')) {
  console.log(`A/B: plunder with and without the legends at work (${runs} lives, 8 years, raider; same seeds)`);
  ABLATE.chronicle = true;
  const off = lives('raider', runs, 8);
  ABLATE.chronicle = false;
  const on = lives('raider', runs, 8);
  const p = (xs: GameState[]) => xs.reduce((n, s) => n + s.stats.plunder, 0) / runs;
  const alive = (xs: GameState[]) => xs.filter((s) => !s.death).length;
  console.log(`  without: plunder ${Math.round(p(off))}, alive ${pct(alive(off))};  with: plunder ${Math.round(p(on))} (${Math.round((100 * (p(on) - p(off))) / p(off))}%), alive ${pct(alive(on))}\n`);
}

console.log(`Lives of ${years} years from 830, ${runs} a policy\n`);
for (const policy of ['raider', 'coward', 'reckless'] as Policy[]) {
  const xs = lives(policy, runs, years);
  const seen = (id: string) => xs.filter((s) => s.seen[id] !== undefined).length;
  const flag = (f: string) => xs.filter((s) => s.flags[f]).length;
  const news = xs.reduce((n, s) => n + (s.chron?.news.filter((x) => x.heard).length ?? 0), 0);
  const sacked = xs.reduce((n, s) => n + Object.values(s.places).filter((p) => p.sacked).length, 0);
  const sworn = xs.filter((s) => s.journal.some((j) => /^Swore his oath to/.test(j.text)));
  const byLord: Record<string, number> = {};
  for (const s of xs) for (const j of s.journal) { const m = /^Swore his oath to (.+)\.$/.exec(j.text); if (m) byLord[m[1]!] = (byLord[m[1]!] ?? 0) + 1; }
  const secret = xs.filter((s) => s.journal.some((j) => /and said nothing to/.test(j.text))).length;
  const cast = xs.filter((s) => (s.flags.oathbreaker ?? 0) > 0).length;
  const answered = xs.reduce((n, s) => n + Object.values(s.lords ?? {}).filter((l) => l.answered).length, 0);
  const holds: Record<string, number> = {};
  for (const s of xs) for (const j of s.journal) {
    if (/^Bought land at/.test(j.text)) holds.bought = (holds.bought ?? 0) + 1;
    if (/^Was given land at/.test(j.text)) holds.grant = (holds.grant ?? 0) + 1;
    if (/^Dug a ship-fort/.test(j.text)) holds.fort = (holds.fort ?? 0) + 1;
    if (/^Lost the ship-fort/.test(j.text)) holds.fortLost = (holds.fortLost ?? 0) + 1;
  }
  const seats = xs.filter((s) => s.journal.some((j) => /^Made /.test(j.text)));
  const seatNames: Record<string, number> = {};
  for (const s of seats) for (const j of s.journal) { const m = /^Made (.+)\.$/.exec(j.text); if (m) seatNames[m[1]!] = (seatNames[m[1]!] ?? 0) + 1; }
  const lostSeat = xs.filter((s) => s.journal.some((j) => /^Lost the seat/.test(j.text))).length;
  const fame = (ys: GameState[]) => { const f = ys.map((s) => livingFame(s)).sort((a, b) => a - b); return f.length ? Math.round(f[Math.floor(f.length / 2)]!) : 0; };
  console.log(`${policy}: alive ${pct(xs.filter((s) => !s.death).length)}, median fame ${fame(xs)}`);
  console.log(`  chronicle: ${avg(news)} news heard a life; ${avg(sacked)} places stripped by others; cameos: Horik ${seen('lg_horik')}, Turgeis ${seen('lg_turgeis')}, Ragnarr ${seen('lg_ragnar')}, Hastein ${seen('lg_hastein')}, Rorik ${seen('lg_rorik')}, the king's poet ${seen('lg_irish_envoy')}`);
  console.log(`  fleets: Liffey 837 met ${seen('cw_837')} joined ${flag('cw_liffey_sworn')}; Lough Neagh met ${seen('cw_839')} Armagh ${flag('cw_armagh_done')}; Nantes arrow ${seen('cw_843')} sailed ${flag('cw_nantes_sworn')} took it ${seen('cw_nantes_won')}`);
  console.log(`  lords: ${pct(sworn.length)} swore an oath (${Object.entries(byLord).map(([k, v]) => `${k} ${v}`).join(', ')}); ${secret} took a second in secret; ${cast} found out and cast out; ${avg(answered)} calls answered a life`);
  console.log(`  land: bought ${holds.bought ?? 0}, granted ${holds.grant ?? 0}, forts dug ${holds.fort ?? 0}, forts lost ${holds.fortLost ?? 0}`);
  console.log(`  rule: ${seats.length} lives took a seat (${Object.entries(seatNames).map(([k, v]) => `${k} ${v}`).join(', ')}); ${lostSeat} lost it; median fame of rulers ${fame(seats)}, of the rest ${fame(xs.filter((s) => !seats.includes(s)))}\n`);
}
