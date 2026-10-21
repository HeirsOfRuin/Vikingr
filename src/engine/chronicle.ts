// The chronicle (docs/FRAME-WORLD.md §B): the world goes on without him. Dated events from the annals strike
// places on their day; the legends raid their own waters every summer by the hero's rules (the same wealth,
// defence and recovery); the news travels, and reaches him in the ports, from the old sailors, and at the turn
// of the year.
import type { ChronRaider, ContentBundle } from '../content/schema';
import type { GameState } from './state';
import { RngCursor, seedRng } from './rng';
import { dateOf, dayOf } from './calendar';
import { test } from './conditions';
import { journal } from './journal';
import { START_YEAR } from './tuning';
import { ABLATE } from './hardship';

export const CHRON = {
  /** Days news takes to reach a port. */
  newsDays: 20,
  /** A legend's summer raid: what the place keeps, and how much more watchful it is. */
  raidKeep: 0.6,
  raidDefence: 0.3,
  /** The summer window a legend's raid falls in. */
  raidFrom: 140,
  raidSpan: 100,
  /** How long a place remembers who stripped it. */
  memoryDays: 400,
} as const;

export interface ChronState {
  /** Events and legend-summers already past ("c834_dorestad", "r_turgeis:836"). */
  done: string[];
  /** big: a dated event from the annals, not a legend's summer raid. */
  news: { day: number; text: string; heard?: boolean; big?: boolean }[];
}

function chron(state: GameState): ChronState {
  return (state.chron ??= { done: [], news: [] });
}

/** A summer's own chance for a legend, from the save: the same world for the same seed, whatever he does. */
function worldRng(state: GameState, key: string): RngCursor {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return new RngCursor(seedRng((state.seed ^ h ^ 0x6c8e9cf5) >>> 0));
}

/** A place struck by somebody else: the same arithmetic as his own raids. */
function sack(state: GameState, id: string, keep: number, defence: number, by: string, day: number): void {
  const ps = state.places[id];
  if (!ps || ps.norse) return;
  ps.wealth = Math.round(ps.wealth * keep);
  ps.defence += defence;
  ps.sacked = { by, day };
}

function placeWord(content: ContentBundle, id: string, by: string): string {
  const p = content.places[id]!;
  if (p.kind === 'monastery') return `${by} burned ${p.name} this summer: the church, the books, and the brothers who didn't run.`;
  if (p.kind === 'town' || p.kind === 'market') return `${by} sacked ${p.name} this summer, and carried off everything they could lift.`;
  return `${by} fell on ${p.name} this summer, and took what there was.`;
}

/** A legend is about his work this year: alive, and in his years. */
function active(content: ContentBundle, r: ChronRaider, year: number): boolean {
  if (year < r.from || year > r.to) return false;
  const leg = r.who ? content.rivals[r.who] : undefined;
  return !leg || (year >= leg.born + 16 && year < leg.died);
}

/** Brings the world up to today. Called after every action; cheap when nothing is due. */
export function tickChronicle(state: GameState, content: ContentBundle): void {
  if (ABLATE.chronicle) return;
  const c = chron(state);
  const done = new Set(c.done);
  for (const ev of Object.values(content.chronicle.events)) {
    if (done.has(ev.id)) continue;
    const day = dayOf(ev.year, ev.doy);
    if (day > state.day) continue;
    c.done.push(ev.id);
    // he was there: the chapter did the work, and he needs nobody to tell him
    if (ev.unless && test(ev.unless, state, content)) continue;
    for (const id of ev.places ?? []) {
      if (ev.norse) { const ps = state.places[id]; if (ps) { ps.norse = true; ps.standing = Math.max(ps.standing ?? 0, 2); } }
      else sack(state, id, ev.keep ?? 1, ev.defence ?? 0, ev.by, day);
    }
    c.news.push({ day, text: ev.news.trim(), big: true });
  }
  const year = dateOf(state.day).year;
  for (const r of Object.values(content.chronicle.raiders)) {
    for (let y = Math.max(r.from, START_YEAR); y <= Math.min(r.to, year); y++) {
      const key = `${r.id}:${y}`;
      if (done.has(key)) continue;
      const rng = worldRng(state, key);
      const day = dayOf(y, CHRON.raidFrom + rng.int(CHRON.raidSpan));
      if (day > state.day) continue;
      c.done.push(key);
      if (!active(content, r, y) || rng.float() >= r.chance) continue;
      // the richest places draw them, as they draw him; not the one he is standing in, nor a Norse-held one
      const open = r.places.filter((id) => state.places[id] && !state.places[id]!.norse && state.at !== id && (state.places[id]!.wealth > 0));
      if (!open.length) continue;
      const total = open.reduce((n, id) => n + state.places[id]!.wealth, 0);
      let roll = rng.float() * total;
      const id = open.find((x) => (roll -= state.places[x]!.wealth) < 0) ?? open[0]!;
      sack(state, id, CHRON.raidKeep, CHRON.raidDefence, r.by, day);
      if (state.known.includes(id)) c.news.push({ day, text: placeWord(content, id, r.by) });
    }
  }
}

/** For a save made before the chronicle existed: everything before today counts as past, with no news. */
export function pastChronicle(state: GameState, content: ContentBundle): ChronState {
  const done = Object.values(content.chronicle.events).filter((e) => dayOf(e.year, e.doy) <= state.day).map((e) => e.id);
  const year = dateOf(state.day).year;
  for (const r of Object.values(content.chronicle.raiders)) for (let y = Math.max(r.from, START_YEAR); y < Math.min(r.to + 1, year); y++) done.push(`${r.id}:${y}`);
  return { done, news: [] };
}

/** Who stripped a place before him, if anyone did lately: a line for the scouts and the raid. */
export function sackedBy(state: GameState, content: ContentBundle, id: string): string | null {
  void content;
  const s = state.places[id]?.sacked;
  if (!s || state.day - s.day > CHRON.memoryDays || s.day > state.day) return null;
  const d = state.day - s.day;
  const when = d <= 12 ? 'not two weeks ago' : d <= 45 ? 'a month or so ago' : dateOf(s.day).year === dateOf(state.day).year ? 'earlier this year' : 'last year';
  return `${s.by} were here ${when}.`;
}

/** News places: home, any market, the Norse, Danish and Swedish ports, and the ship-forts. */
export function newsTravels(state: GameState, content: ContentBundle, at: string): boolean {
  const p = content.places[at];
  if (!p) return false;
  return p.kind === 'home' || !!p.market || ['norse', 'danish', 'swedish'].includes(p.people) || !!state.places[at]?.norse;
}

/** The news that has reached him (all of it, at the turn of the year or from the old sailors). Marks it heard. */
export function hearNews(state: GameState, all = false): string[] {
  const c = state.chron;
  if (!c) return [];
  const lines: string[] = [];
  for (const n of c.news) {
    if (n.heard || n.day > state.day || (!all && n.day + CHRON.newsDays > state.day)) continue;
    n.heard = true;
    lines.push(n.text);
    journal(state, `News: ${n.text.split(/(?<=\.)\s/)[0]}`);
  }
  return lines;
}

/** In a port, now: news waiting to be heard. */
export function newsWaiting(state: GameState, content: ContentBundle): boolean {
  if (!state.at || state.voyage || state.phase === 'winter' || !state.chron) return false;
  if (!newsTravels(state, content, state.at)) return false;
  return state.chron.news.some((n) => !n.heard && n.day + CHRON.newsDays <= state.day);
}
