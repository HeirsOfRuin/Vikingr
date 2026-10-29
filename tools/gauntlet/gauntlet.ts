// The gauntlet, phase 1 (docs/FRAME-GAUNTLET.md): many lives, every era, background and way of playing, checked
// after every action. Usage: npm run gauntlet -- [--lives 60] [--years 10] [--fast]
// Writes gauntlet-out/report.md and gauntlet-out/report.json. Exits 1 on any error (not on season findings).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { loadContent } from '../content-loader';
import { Bot, type Policy } from '../bot-lib';
import { newGame, act, listActions, type Action } from '../../src/engine/index';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { dateOf } from '../../src/engine/calendar';
import { toSave, fromSave } from '../../src/engine/save';
import { encodeSaveCode, decodeSaveCode } from '../../src/engine/savecode';
import type { GameState } from '../../src/engine/state';
import { checkStep, type Problem } from './invariants';
import { Coverage, Explorer } from './explorer';

const args = process.argv.slice(2);
const arg = (k: string, d: number) => { const i = args.indexOf(`--${k}`); return i >= 0 ? Number(args[i + 1]) : d; };
const FAST = args.includes('--fast');
const LIVES = arg('lives', FAST ? 18 : 90);
const YEARS = arg('years', FAST ? 5 : 10);
const ROUNDTRIP_EVERY = 150;
const OUT = join(import.meta.dirname, '..', '..', 'gauntlet-out');

type Style = Policy | 'explorer';
const STYLES: Style[] = ['explorer', 'raider', 'random', 'coward', 'reckless', 'explorer', 'homebody', 'explorer', 'random'];
const ERAS = [830, 843, 865] as const;
const BGS = ['younger_son', 'outlaw', 'freedman'];

interface Life { n: number; era: number; bg: string; style: Style; seed: number }
interface Finding extends Problem { life: Life; step: number; date: string; where: string; code?: string; before?: GameState }

const content = loadContent();
const cov = new Coverage();
const findings = new Map<string, Finding[]>(); // by rule
const counts = new Map<string, number>();
const seenScenes = new Map<string, number>();
const firstSeen = new Map<string, Life>();
let steps = 0, years = 0, deaths = 0;
const t0 = Date.now();

function where(s: GameState): string {
  const p = s.pending?.t === 'scene' ? `scene ${s.pending.id}` : s.pending ? `${s.pending.t} screen` : `${s.phase}`;
  return `${s.at ? content.places[s.at]?.name ?? s.at : 'at sea'}, ${p}`;
}
function note(p: Problem, life: Life, step: number, s: GameState, before: GameState | null): void {
  counts.set(p.rule, (counts.get(p.rule) ?? 0) + 1);
  const list = findings.get(p.rule) ?? [];
  // up to three different examples a rule, the first of each kind of detail
  const kind = p.detail.replace(/\d+/g, '#');
  if (list.length < 3 && !list.some((f) => f.detail.replace(/\d+/g, '#') === kind)) {
    const d = dateOf(s.day);
    list.push({ ...p, life, step, date: `${d.year}, day ${d.doy}`, where: where(s), before: before ? structuredClone(before) : structuredClone(s) });
    findings.set(p.rule, list);
  }
}
/** The first place two states differ, as a path. */
function diff(a: unknown, b: unknown, path = 'state'): string | null {
  if (a === b) return null;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return `${path}: ${JSON.stringify(a)?.slice(0, 60)} vs ${JSON.stringify(b)?.slice(0, 60)}`;
  const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
  for (const k of keys) { const d = diff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`); if (d) return d; }
  return null;
}
function roundTrip(s: GameState): string | null {
  const back = fromSave(JSON.parse(JSON.stringify(toSave(s, content))), content).state;
  return diff(JSON.parse(JSON.stringify(s)), JSON.parse(JSON.stringify(back)));
}

for (let n = 0; n < LIVES; n++) {
  const life: Life = { n, era: ERAS[n % 3]!, bg: BGS[Math.floor(n / 3) % 3]!, style: STYLES[n % STYLES.length]!, seed: 7000 + n };
  let state = newGame(content, { background: life.bg, seed: life.seed, name: 'Gauntlet', ...(life.era === 830 ? {} : { era: life.era as 843 | 865 }) });
  const past = new Set(Object.keys(state.seen));
  const rng = new RngCursor(seedRng(life.seed ^ 0x5bd1e995));
  const bot = life.style === 'explorer' ? new Explorer(cov, rng) : new Bot(life.style, rng);
  const startYear = dateOf(state.day).year;
  let prev: GameState | null = null, still = 0, step = 0;
  for (const p of checkStep(null, state, content)) note(p, life, 0, state, null);
  while (!state.death && dateOf(state.day).year < startYear + YEARS) {
    let a: Action | null;
    try { a = bot.choose(state, content); } catch (e) { note({ rule: 'bot crashed', severity: 'error', detail: (e as Error).message }, life, step, state, prev); break; }
    if (!a) { note({ rule: 'dead end', severity: 'error', detail: `no action on ${where(state)}` }, life, step, state, prev); break; }
    if (!listActions(state, content).some((o) => o.enabled && JSON.stringify(o.action) === JSON.stringify(a))) note({ rule: 'bot chose an action not on offer', severity: 'error', detail: a.t }, life, step, state, prev);
    let next: GameState;
    try { next = act(content, state, a); } catch (e) { note({ rule: 'action failed', severity: 'error', detail: `${a.t}: ${(e as Error).message}` }, life, step, state, state); break; }
    prev = state; state = next; step++; steps++;
    for (const p of checkStep(prev, state, content)) note(p, life, step, state, prev);
    if (state.day === prev.day) { if (++still > 300) { note({ rule: 'softlock', severity: 'error', detail: `300 actions without time passing on ${where(state)}` }, life, step, state, prev); break; } } else still = 0;
    if (step % ROUNDTRIP_EVERY === 0) { const d = roundTrip(state); if (d) note({ rule: 'save does not round-trip', severity: 'error', detail: d }, life, step, state, null); }
  }
  // the save code a player copies: it must load back to the same life
  try {
    const back = fromSave(await decodeSaveCode(await encodeSaveCode(toSave(state, content))), content).state;
    const d = diff(JSON.parse(JSON.stringify({ ...state, journal: [] })), JSON.parse(JSON.stringify({ ...back, journal: [] })));
    if (d) note({ rule: 'save code does not round-trip', severity: 'error', detail: d }, life, step, state, null);
  } catch (e) { note({ rule: 'save code does not round-trip', severity: 'error', detail: (e as Error).message }, life, step, state, null); }
  for (const id of Object.keys(state.seen)) if (!past.has(id) && content.scenes[id]) { seenScenes.set(id, (seenScenes.get(id) ?? 0) + 1); if (!firstSeen.has(id)) firstSeen.set(id, life); }
  years += dateOf(state.day).year - startYear;
  if (state.death) deaths++;
  if ((n + 1) % 10 === 0) process.stdout.write(`  ${n + 1}/${LIVES} lives, ${steps} actions\n`);
}

// save codes for the examples: paste one into the game's Load box to stand where it happened
for (const list of findings.values()) for (const f of list) { if (f.before) f.code = await encodeSaveCode(toSave(f.before, content)); delete f.before; }

// coverage: what no life reached, and what it was waiting for
const all = Object.values(content.scenes).filter((s) => !s.placeholder && !s.id.startsWith('p1_'));
const never = all.filter((s) => !seenScenes.has(s.id));
const byFile = new Map<string, string[]>();
for (const s of never) { const k = s.id.split('_')[0]!; byFile.set(k, [...(byFile.get(k) ?? []), s.id]); }

const errors = [...findings.values()].flat().filter((f) => f.severity === 'error');
const errorRules = [...counts.entries()].filter(([r]) => findings.get(r)?.[0]?.severity === 'error');
const seasonRules = [...counts.entries()].filter(([r]) => findings.get(r)?.[0]?.severity === 'season');
const lines: string[] = [];
const secs = Math.round((Date.now() - t0) / 1000);
lines.push(`# Gauntlet report`, '', `${LIVES} lives (${years} years played, ${deaths} died), ${steps} actions, ${secs}s. Eras 830/843/865 × three backgrounds × ${new Set(STYLES).size} ways of playing; every action checked.`, '');
lines.push(`## Errors: ${errorRules.length ? errorRules.map(([r, c]) => `${r} (${c})`).join(', ') : 'none'}`, '');
const textRules = [...counts.entries()].filter(([r]) => findings.get(r)?.[0]?.severity === 'text');
lines.push(`## Text findings: ${textRules.length ? textRules.map(([r, c]) => `${r} (${c})`).join(', ') : 'none'}`, '');
lines.push(`## Season findings: ${seasonRules.length ? seasonRules.map(([r, c]) => `${r} (${c} actions)`).join(', ') : 'none'}`, '');
for (const [rule, list] of findings) {
  lines.push(`### ${rule} (${list[0]!.severity}, ${counts.get(rule)} times)`);
  for (const f of list) lines.push(`- ${f.detail}. Life ${f.life.n} (${f.life.era}, ${f.life.bg}, ${f.life.style}, seed ${f.life.seed}), action ${f.step}, ${f.date}, ${f.where}.`, `  - Save code (just before): \`${f.code?.slice(0, 40)}…\` (full code in report.json)`);
  lines.push('');
}
lines.push(`## Coverage`, '', `${all.length - never.length} of ${all.length} scenes seen (${Math.round((100 * (all.length - never.length)) / all.length)}%). Explorer choices tried: ${cov.choices.size}.`, '');
lines.push(`Never seen, by group: ${[...byFile.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, v]) => `${k} ${v.length}`).join(', ')}`, '');

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'report.md'), lines.join('\n'));
writeFileSync(join(OUT, 'report.json'), JSON.stringify({ lives: LIVES, years, steps, secs, counts: Object.fromEntries(counts), findings: Object.fromEntries(findings), never: never.map((s) => ({ id: s.id, requires: s.requires ?? null, trigger: s.trigger ?? null, at: s.at ?? null })) }, null, 1));
console.log(lines.slice(0, 6).join('\n'));
for (const [rule, list] of findings) console.log(`  ${list[0]!.severity === 'error' ? 'ERROR ' : list[0]!.severity.padEnd(6)} ${rule}: ${counts.get(rule)} (e.g. ${list[0]!.detail}; ${list[0]!.where}, ${list[0]!.date})`);
console.log(`coverage: ${all.length - never.length}/${all.length} scenes; report in ${relative(process.cwd(), OUT)}/report.md`);
process.exit(errors.length ? 1 : 0);
