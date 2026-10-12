// Standing in the ports (DESIGN §11.6): what each place thinks of him. Everything a port will or won't do for
// him is derived from one number: whether he may dock, buy food, hire men or winter there, or is fought on landing.
import type { ContentBundle, People } from '../content/schema';
import type { GameState } from './state';
import { journal } from './journal';
import { aliveMen, capacity, mouths } from './crew';
import { PROVISION_ORTUG_PER, SIGN_ON_GIFT } from './tuning';

export const STANDING_MIN = -10;
export const STANDING_MAX = 10;

/** Where a people starts, before anything has happened between you. A place can override it. */
export const PEOPLE_BASE: Record<People, number> = {
  norse: 2, danish: 0, swedish: 0, gael: -2, english: -2, frisian: 0, frankish: -1, baltic: 0, rus: 0,
};

export type Tier = 'hostile' | 'unfriendly' | 'wary' | 'friendly' | 'allied';
export const TIER_NAMES: Record<Tier, string> = { hostile: 'Hostile', unfriendly: 'Unfriendly', wary: 'Wary', friendly: 'Friendly', allied: 'Allied' };
export const TIER_HINTS: Record<Tier, string> = {
  hostile: 'They will fight you if you try to land.',
  unfriendly: 'You may put in, but they will sell you nothing, and their cattle have owners.',
  wary: 'They will sell you food, at a price, and keep their sons at home.',
  friendly: 'They will sell you food at a fair price, and some of their young men would row for you.',
  allied: 'They feed you cheap, and their young men come down to the shore asking for a place at your oars.',
};

export function tierOf(n: number): Tier {
  return n <= -6 ? 'hostile' : n <= -2 ? 'unfriendly' : n <= 1 ? 'wary' : n <= 5 ? 'friendly' : 'allied';
}

/** Food: ørtugar per 20 man-days, multiplied by this. null: they won't sell. */
export const RESUPPLY_PRICE: Record<Tier, number | null> = { hostile: null, unfriendly: null, wary: 2, friendly: 1, allied: 0.5 };
/** Men who will sign on in a summer, at a port whose people would row in a Norse ship. */
export const HIRE_POOL: Record<Tier, number> = { hostile: 0, unfriendly: 0, wary: 0, friendly: 4, allied: 8 };
const HIRING_PEOPLES: People[] = ['norse', 'danish', 'swedish'];
/** What a raid does: at the place, and to every other place of the same people. */
export const RAID_HIT = { place: -5, burned: -2, captives: -1, failed: -3, kin: -2 } as const;

export function baseStanding(content: ContentBundle, id: string): number {
  const p = content.places[id]!;
  return p.standing ?? PEOPLE_BASE[p.people];
}

export function standing(state: GameState, content: ContentBundle, id: string): number {
  return state.places[id]?.standing ?? baseStanding(content, id);
}

export function tierAt(state: GameState, content: ContentBundle, id: string): Tier {
  return tierOf(standing(state, content, id));
}

export function canHire(state: GameState, content: ContentBundle, id: string): number {
  const p = content.places[id]!;
  if (p.kind === 'home' || !HIRING_PEOPLES.includes(p.people)) return 0;
  return Math.max(0, HIRE_POOL[tierAt(state, content, id)] - (state.places[id]?.hired ?? 0));
}

/** Moves his standing at one place. Home never moves. Says so in the journal when the place's mood changes. */
export function shiftStanding(state: GameState, content: ContentBundle, id: string, n: number): void {
  const p = content.places[id];
  const ps = state.places[id];
  if (!p || !ps || p.kind === 'home' || !n) return;
  const before = standing(state, content, id);
  const after = Math.max(STANDING_MIN, Math.min(STANDING_MAX, before + n));
  ps.standing = after;
  const t0 = tierOf(before);
  const t1 = tierOf(after);
  if (t0 !== t1 && state.known.includes(id)) journal(state, `${p.name} is ${TIER_NAMES[t1].toLowerCase()} to you now.`);
}

/** Every place of a people, except `except`. */
export function shiftPeople(state: GameState, content: ContentBundle, people: People, n: number, except?: string): void {
  for (const p of Object.values(content.places)) if (p.people === people && p.id !== except) shiftStanding(state, content, p.id, n);
}

/** A raid, won or failed: the place remembers, and so do its kin along the coast. */
export function onRaided(state: GameState, content: ContentBundle, id: string, how: { burned?: boolean; captives?: boolean; failed?: boolean }): void {
  const p = content.places[id];
  if (!p) return;
  const hit = how.failed ? RAID_HIT.failed : RAID_HIT.place + (how.burned ? RAID_HIT.burned : 0) + (how.captives ? RAID_HIT.captives : 0);
  shiftStanding(state, content, id, hit);
  shiftPeople(state, content, p.people, RAID_HIT.kin + (how.burned ? -1 : 0), id);
}

/** The turn of the year: a third of the way back toward where each place started. Grudges fade, slowly. */
export function driftStanding(state: GameState, content: ContentBundle): void {
  for (const [id, ps] of Object.entries(state.places)) {
    if (ps.standing === undefined || !content.places[id]) continue;
    const base = baseStanding(content, id);
    const d = base - ps.standing;
    ps.standing += Math.sign(d) * Math.ceil(Math.abs(d) / 3);
    ps.hired = 0;
  }
}

// ---- what a port will do for him ----

export const RESUPPLY_DAYS = 30;
/** Guest-right: a friendly hall feeds a ship's crew once a year, free. Days of food. */
export const GUEST_DAYS: Record<Tier, number> = { hostile: 0, unfriendly: 0, wary: 0, friendly: 7, allied: 14 };
/** Fighting your way ashore at a hostile port: about this many come down to the beach. */
const LANDING_FOE: Record<People, string> = {
  norse: 'rival_crew', danish: 'rival_crew', swedish: 'rival_crew', gael: 'ulster_levy', english: 'northumbrian_levy',
  frisian: 'island_men', frankish: 'island_men', baltic: 'island_men', rus: 'island_men',
};

export function landingFoe(content: ContentBundle, id: string): { foe: string; men: number } {
  const p = content.places[id]!;
  return { foe: p.raid?.foe ?? LANDING_FOE[p.people], men: Math.max(10, Math.round((p.raid?.defenders ?? 14) * 0.8)) };
}

/** Food to last RESUPPLY_DAYS, at this port's price. null: they won't sell. */
export function resupplyCost(state: GameState, content: ContentBundle, id: string): { need: number; cost: number } | null {
  const mult = RESUPPLY_PRICE[tierAt(state, content, id)];
  if (mult === null) return null;
  const need = Math.max(0, mouths(state) * RESUPPLY_DAYS - state.provisions);
  return { need, cost: Math.ceil((need / PROVISION_ORTUG_PER) * mult) };
}

/** Men he can hire here now: willing, with benches for them, and with the sign-on gift in his purse. */
export function hireable(state: GameState, content: ContentBundle, id: string): number {
  const room = Math.max(0, capacity(state, content) - state.crew.men - aliveMen(state).length);
  return Math.max(0, Math.min(canHire(state, content, id), room, Math.floor(state.silver / SIGN_ON_GIFT)));
}
