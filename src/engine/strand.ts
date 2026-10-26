// Harrying the shore between the ports (playtest 10: "the point was to attack the coasts and settlements in-between
// listed ports on the map"). From a port on a raidable coast he takes the ships along the shore for a day and his
// lookouts find an unnamed settlement: a fishing hamlet, a farm, a church, a market village, a lord's hall, of the
// people who live there (content/registry/strands.yaml). He lands or sails on. The fight and the plunder are the
// raid's own; the coast remembers: each raid on it this year brings out more men and leaves less to take.
import type { ContentBundle, StrandKind } from '../content/schema';
import type { BattleTerrain } from '../content/schema';
import type { GameState } from './state';
import type { RngCursor } from './rng';
import { dateOf } from './calendar';
import { mouths } from './crew';
import { coastOf } from './cruise';
import { LATE_SEASON_DOY } from './tuning';
import { shiftStanding } from './standing';
import { alarmRegion } from './hardship';
import { startBattle } from './fights';

export interface StrandTarget {
  coast: string;
  /** The named port he set out from: the shore is near it, and its people remember. */
  anchor: string;
  kind: string;
  label: string;
  desc: string;
  people: string;
  men: number;
  wealth: number;
  foe: string;
  terrain: BattleTerrain;
  /** Days of food for the crew in cattle and stores, if it is taken. */
  food: number;
  goods: string;
}

export const STRAND = {
  /** Each raid on a coast this year: this many more defenders turn out at the next. */
  alarmMen: 0.2,
  /** ... and this much less is left to take (they have driven the cattle inland and buried the silver). */
  alarmWealth: 0.12,
  /** Never less than this share of what a place would hold on a quiet coast. */
  wealthFloor: 0.35,
  /** A day along the shore to find a place, and another to look further. */
  days: 1,
  /** His standing with the port he set out from, for each place on its shore. */
  standingHit: -1,
  /** The chance a place on a quiet coast is taken by surprise, less this for each raid on the coast this year. */
  surprise: 0.5,
  surpriseFall: 0.1,
  /** Taken by surprise, this share of its men stand. */
  surprisedMen: 0.6,
} as const;

/** The coast a place lies on, if its shore can be harried: a known coast, a people with a shore table. */
export function harryCoast(state: GameState, content: ContentBundle, at: string | null): string | null {
  if (!at) return null;
  const p = content.places[at];
  if (!p || p.kind === 'home' || !content.strands.peoples[p.people]) return null;
  return coastOf(content, at);
}

/** Raids on this coast this year. */
export function harried(state: GameState, coast: string): number {
  const h = state.harried?.[coast];
  return h && h.year === dateOf(state.day).year ? h.n : 0;
}

export function alarmWord(n: number): string {
  return n === 0 ? 'quiet' : n <= 2 ? 'wary' : n <= 4 ? 'roused' : 'up in arms';
}

/** Why he can't harry here now, or null. */
export function harryBlock(state: GameState, content: ContentBundle): string | null {
  if (state.service) return 'At another man\'s oar, the captain chooses where to land.';
  if (!state.ships.length) return 'You have no ship.';
  if (!harryCoast(state, content, state.at)) return 'There is no shore here worth harrying.';
  if (dateOf(state.day).doy >= LATE_SEASON_DOY) return 'The sailing season is over.';
  if (state.provisions < mouths(state) * 2) return 'Not enough food to go along the coast.';
  return null;
}

/** The lookouts find a place along this shore. */
export function findStrand(state: GameState, content: ContentBundle, rng: RngCursor, at: string): StrandTarget {
  const coast = harryCoast(state, content, at)!;
  const people = content.places[at]!.people;
  const pt = content.strands.peoples[people]!;
  const kinds = Object.values(content.strands.kinds);
  const k: StrandKind = rng.pickWeighted(kinds, (x) => x.weight) ?? kinds[0]!;
  const n = harried(state, coast);
  const roll = (r: readonly [number, number]) => r[0] + rng.int(r[1] - r[0] + 1);
  const men = Math.max(2, Math.round(roll(k.men) * (1 + STRAND.alarmMen * n)));
  const wealth = Math.round(roll(k.wealth) * Math.max(STRAND.wealthFloor, 1 - STRAND.alarmWealth * n));
  return {
    coast, anchor: at, kind: k.id, label: k.label, desc: k.desc[rng.int(k.desc.length)]!, people,
    men, wealth, foe: pt[k.defenders], terrain: k.terrain as BattleTerrain,
    food: Math.round(k.food * Math.max(STRAND.wealthFloor, 1 - STRAND.alarmWealth * n)), goods: pt[k.goods],
  };
}

/** A place on this shore has been raided: the coast's alarm, and the nearest port's memory. */
export function strandRaided(state: GameState, content: ContentBundle, t: StrandTarget): void {
  const year = dateOf(state.day).year;
  const h = state.harried?.[t.coast];
  (state.harried ??= {})[t.coast] = { year, n: (h && h.year === year ? h.n : 0) + 1 };
  shiftStanding(state, content, t.anchor, STRAND.standingHit);
  alarmRegion(state, content, t.anchor, false);
}

/** He lands: the fight is a raid's, against the place's own men, and it may be caught napping. */
export function landStrand(state: GameState, content: ContentBundle, rng: RngCursor, t: StrandTarget): void {
  const n = harried(state, t.coast);
  // a quiet coast is often taken in the fields; a roused one has a lookout on every headland
  const surprise = rng.float() < Math.max(0.1, STRAND.surprise - STRAND.surpriseFall * n);
  const men = surprise ? Math.max(2, Math.round(t.men * STRAND.surprisedMen)) : t.men;
  startBattle(state, content, { foe: t.foe, men, terrain: t.terrain, context: 'raid', place: t.anchor });
  if (state.pending?.t === 'battle') {
    state.pending.battle.strand = t;
    state.pending.battle.log.unshift(surprise ? 'You come up from the boats before they know you are there; most of the men are out in the fields.' : 'They have seen the ships. They are waiting for you.');
  }
}
