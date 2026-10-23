// Deeds, telling, fading, verses, and the table of living legends.
// A deed adds to fame only once it has been told (DESIGN §7).
import { SKALD, skaldSees } from './skald';
import { ABLATE } from './hardship';
import { FIGHT_DEEDS, NAMED_FAME } from './items';
import type { ContentBundle, Rival } from '../content/schema';
import type { Deed, GameState } from './state';
import { dateOf } from './calendar';
import { SEAT_DEF } from './rule';
import { FAME_FADE_DAYS, FAME_FADE_PER_YEAR, VERSE_LASTING_MULT } from './tuning';

/** What an old deed still carries each time it is told again. */
export const RETELL = 0.8;

/** Deeds this heavy tell themselves: men talk of them without a feast. */
export const SELF_TELLING = 8;

export function addDeed(
  state: GameState,
  content: ContentBundle,
  d: { type: string; text?: string; weight?: number; witnesses?: number; mult?: number },
): Deed {
  const def = content.deeds[d.type];
  if (!def) throw new Error(`unknown deed type ${d.type}`);
  // a fighting deed done with a named weapon in his hand is told with the weapon's name in it (FRAME-FOUNDATION §3)
  const named = FIGHT_DEEDS.includes(d.type) && !!state.items?.find((x) => x.uid === state.kit?.weapon)?.name;
  // a skald aboard saw it done, and has it in verse before the ship is home (playtest 8)
  const seen = skaldSees(state) ? SKALD.aboardDeed : 1;
  const weight = Math.round((d.weight ?? def.weight) * (d.mult ?? 1) * (named ? NAMED_FAME : 1) * seen * 10) / 10;
  const deed: Deed = {
    n: state.deeds.length + 1,
    type: d.type,
    day: state.day,
    place: state.at,
    text: d.text ?? def.name,
    weight,
    witnesses: d.witnesses ?? 0,
    told: weight >= SELF_TELLING ? state.day : null,
    verse: false,
  };
  state.deeds.push(deed);
  return deed;
}

/** The fame one deed carries on a given day. */
export function deedFame(deed: Deed, day: number): number {
  if (deed.verse) return deed.weight;
  if (deed.told === null) return 0;
  const age = day - deed.told;
  if (age <= FAME_FADE_DAYS) return deed.weight;
  return deed.weight * Math.pow(FAME_FADE_PER_YEAR, (age - FAME_FADE_DAYS) / 365);
}

export function livingFame(state: GameState): number {
  return Math.round(state.deeds.reduce((s, d) => s + deedFame(d, state.day), 0) * 10) / 10;
}

export function lastingFame(state: GameState): number {
  return Math.round(state.deeds.filter((d) => d.verse).reduce((s, d) => s + d.weight * VERSE_LASTING_MULT, 0) * 10) / 10;
}

/** Tells every deed not told within the fade window. Returns the deeds told and the fame they added. */
export function tellDeeds(state: GameState): { told: Deed[]; fresh: Deed[]; gained: number } {
  const before = livingFame(state);
  const told: Deed[] = [];
  const fresh: Deed[] = [];
  for (const d of state.deeds) {
    if (d.verse) continue;
    if (d.told === null || state.day - d.told > FAME_FADE_DAYS / 2) {
      // the same story for the fifth winter running: each retelling carries less (docs/FRAME-HARDSHIP.md)
      if (d.told !== null && !ABLATE.fame) d.weight = Math.round(d.weight * RETELL * 10) / 10;
      else fresh.push(d);
      d.told = state.day;
      told.push(d);
    }
  }
  return { told, fresh, gained: Math.round((livingFame(state) - before) * 10) / 10 };
}

/** The skald makes a verse of the heaviest told deed that has none. */
export function composeVerse(state: GameState): Deed | null {
  const best = state.deeds.filter((d) => !d.verse && d.told !== null).sort((a, b) => b.weight - a.weight || a.n - b.n)[0];
  if (!best) return null;
  best.verse = true;
  return best;
}

export function untoldCount(state: GameState): number {
  return state.deeds.filter((d) => d.told === null).length;
}

/** A rival's living fame in a year: linear between the curve's points, zero before he is grown and after he is dead. */
export function rivalFame(r: Rival, year: number): number {
  if (year >= r.died || year < r.born + 16) return 0;
  const c = r.curve;
  if (year <= c[0]![0]) return c[0]![1] * Math.max(0, (year - (r.born + 16)) / Math.max(1, c[0]![0] - (r.born + 16)));
  for (let i = 1; i < c.length; i++) {
    const [y1, f1] = c[i]!;
    const [y0, f0] = c[i - 1]!;
    if (year <= y1) return f0 + ((f1 - f0) * (year - y0)) / (y1 - y0);
  }
  return c[c.length - 1]![1];
}

/** A legend's fame as men tell it: his curve, and what has happened to him since (docs/FRAME-WORLD.md §B). */
export function legendFame(state: GameState, r: Rival, year: number): number {
  const base = rivalFame(r, year);
  return base > 0 ? Math.max(1, base + (state.legends?.[r.id] ?? 0)) : 0;
}

export interface LegendRow {
  id: string;
  name: string;
  fame: number;
  hero: boolean;
}

/** The greatest living legends, the hero among them, highest first. */
export function legendTable(state: GameState, content: ContentBundle): LegendRow[] {
  const year = dateOf(state.day).year;
  const rows: LegendRow[] = Object.values(content.rivals)
    .map((r) => ({ id: r.id, name: r.name, fame: Math.round(legendFame(state, r, year)), hero: false }))
    .filter((r) => r.fame > 0);
  rows.push({ id: 'hero', name: heroName(state), fame: Math.round(livingFame(state)), hero: true });
  return rows.sort((a, b) => b.fame - a.fame || (a.hero ? 1 : -1));
}

export function fameRank(state: GameState, content: ContentBundle): number {
  return legendTable(state, content).findIndex((r) => r.hero) + 1;
}

export function heroName(state: GameState): string {
  const n = state.hero.nickname ? `${state.hero.name} ${state.hero.nickname}` : state.hero.name;
  return state.rule ? `${n}, ${SEAT_DEF[state.rule.seat].title}` : n;
}
