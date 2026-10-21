// The base (FRAME-FOUNDATION §4): where he keeps what he wins. His father's farm while he is young; a farm of his
// own; a hall. Thralls work it, his wife runs it, trophies hang on its walls, and his hoard is buried under its floor.
import type { ContentBundle } from '../content/schema';
import type { GameState } from './state';
import { journal } from './journal';
import { formatSilver, plural } from './format';
import { livingFame } from './fame';
import { earn, yieldAfterHarvest } from './hardship';

export type BaseLevel = 'father' | 'farm' | 'hall';
export const BASE_LEVELS: BaseLevel[] = ['father', 'farm', 'hall'];

export interface BaseState {
  level: BaseLevel;
  thralls: number;
  /** Silver kept at home: safe from the sea. */
  hoard: number;
  /** Item ids hung on the wall. */
  trophies: string[];
  wife: string | null;
}

export const BASE: Record<BaseLevel, { name: string; desc: string; thralls: number; perThrall: number; income: number; muster: number }> = {
  father: { name: "Your father's farm", desc: 'A bench by your father\'s fire, a corner of his byre, and your mother\'s opinion of everything you bring home.', thralls: 4, perThrall: 1, income: 0, muster: 0 },
  farm: { name: 'Your own farm', desc: 'A longhouse of your own, turf-roofed, with a byre at one end, a field, a strip of shore, and a door nobody else can shut on you.', thralls: 6, perThrall: 3, income: 12, muster: 1 },
  hall: { name: 'Your hall', desc: 'A hall with carved posts and a high seat, long enough to feast forty men, where your trophies hang and your name is said at the door.', thralls: 12, perThrall: 3, income: 24, muster: 4 },
};
/** A farm of his own: 4 pounds. A hall on it: 12 pounds, and a name men know. */
export const FARM_PRICE = 192;
export const HALL_PRICE = 576;
export const HALL_FAME = 30;
/** What a wife's running of the place adds to its yield. */
export const WIFE_YIELD = 1.25;
/** Feasts in his own hall tell his deeds better; trophies on the walls better still. */
export const HALL_FEAST = 0.15;
export const TROPHY_FEAST = 0.05;
export const TROPHY_FEAST_MAX = 0.25;

export function newBase(): BaseState {
  return { level: 'father', thralls: 0, hoard: 0, trophies: [], wife: null };
}

export function thrallRoom(state: GameState): number {
  return Math.max(0, BASE[state.base.level].thralls - state.base.thralls);
}

/** Captives kept to work the land instead of sold: as many as there is work for. Returns how many. */
export function keepCaptives(state: GameState): number {
  const n = Math.min(state.captives, thrallRoom(state));
  state.captives -= n;
  state.base.thralls += n;
  if (n) journal(state, `Kept ${plural(n, 'captive')} as ${n === 1 ? 'a thrall' : 'thralls'} at ${BASE[state.base.level].name.toLowerCase()}.`);
  return n;
}

/** What the place brings in over a winter. */
export function winterYield(state: GameState): number {
  const b = BASE[state.base.level];
  return Math.round((state.base.thralls * b.perThrall + b.income) * (state.base.wife ? WIFE_YIELD : 1));
}

export function takeWinterYield(state: GameState): string | null {
  const full = winterYield(state);
  const n = yieldAfterHarvest(state, full);
  if (full && !n) return 'The harvest failed. The place has fed its own people through the winter, just, and brought in nothing.';
  if (!n) return null;
  state.silver += n;
  earn(state, n);
  journal(state, `${BASE[state.base.level].name} brought in ${formatSilver(n)} over the winter.`);
  const who = state.base.wife ? `${state.base.wife} has kept the place` : 'The place has kept itself';
  return `${who} through the winter${state.base.thralls ? `, with ${plural(state.base.thralls, 'thrall')} at the work` : ''}: ${formatSilver(n)} in wool, butter and hides.`;
}

/** How much better his deeds are told at a feast in his own hall. */
export function feastMult(state: GameState): number {
  if (state.base.level === 'father' || state.at !== (state.homeAt ?? 'home_fjord')) return 1;
  return (state.base.level === 'hall' ? 1 + HALL_FEAST : 1) * (1 + Math.min(TROPHY_FEAST_MAX, TROPHY_FEAST * state.base.trophies.length));
}

export function hallActionsFor(state: GameState, base: number): number {
  return base + (state.base.level === 'hall' && state.at === (state.homeAt ?? 'home_fjord') ? 1 : 0);
}

/** A hall that burned is raised again on its old stones, at half the price (docs/FRAME-HARDSHIP.md). */
export function hallPrice(state: GameState): number {
  return state.flags.hall_burned ? Math.round(HALL_PRICE / 2) : HALL_PRICE;
}

export function canBuildHall(state: GameState): string | null {
  if (state.base.level !== 'farm') return state.base.level === 'hall' ? 'You have a hall.' : 'You need a farm of your own to build it on.';
  if (livingFame(state) < HALL_FAME) return 'Nobody would come to the hall of a man without a name. Not yet.';
  if (state.silver < hallPrice(state)) return `You need ${formatSilver(hallPrice(state))}.`;
  return null;
}

/** A keepsake hung on the wall: it leaves his sea-chest, and the feasts are better for it. */
export function hangTrophy(state: GameState, content: ContentBundle, id: string): void {
  const i = state.items.findIndex((x) => x.id === id);
  if (i < 0) return;
  state.items.splice(i, 1);
  state.base.trophies.push(id);
  journal(state, `Hung ${content.items[id]!.name.charAt(0).toLowerCase()}${content.items[id]!.name.slice(1)} on the wall at home.`);
}

/** Keepsakes that would look well on a wall. */
export function hangable(state: GameState, content: ContentBundle): string[] {
  return state.items.filter((x) => content.items[x.id]?.trophy).map((x) => x.id);
}
