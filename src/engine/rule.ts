// Rule (docs/FRAME-WORLD.md §E): jarl or king of a place, against a rival with a name. The claim is one number,
// shown in full, and so is the rival's; a legend's claim is his fame on the same table as the hero's.
import type { ContentBundle } from '../content/schema';
import type { GameState } from './state';
import type { RngCursor } from './rng';
import { dateOf } from './calendar';
import { livingFame, legendFame, addDeed } from './fame';
import { aliveMen } from './crew';
import { journal } from './journal';
import { formatSilver, plural } from './format';
import { lordAlive, lordDies, lordFav, lordName, swornTo } from './lords';
import { standing } from './standing';
import { holdingAt } from './land';
import { earn } from './hardship';

export type Seat = 'orkney' | 'dublin' | 'home' | 'walcheren';
export const SEATS: Seat[] = ['orkney', 'dublin', 'home', 'walcheren'];

export const RULE = {
  tribute: 120,
  men: 10,
  deed: 40,
  /** He must be seen: winter at the seat at least this often (years), or it falls to the rival. */
  absent: 2,
  /** A rival's challenge, a year. */
  challenge: 0.25,
  /** Claim: his name counts for half, men for half, the old lord's favour five a point, standing three. */
  perFame: 0.5,
  perMan: 0.5,
  /** A legend's claim: half his fame, and his fleet. */
  legendBase: 100,
  perFavour: 5,
  perStanding: 3,
  kin: 40,
  /** A lord's favour that ties a man to his seat. */
  tieFavour: 3,
  land: 20,
  /** The jarl in Hordaland dies in a year between these. */
  jarlDies: [842, 850] as [number, number],
} as const;

export const SEAT_DEF: Record<Seat, { place: string; title: string; lord?: string; minFame: number }> = {
  orkney: { place: 'orkney', title: 'jarl in Orkney', lord: 'harek', minFame: 120 },
  dublin: { place: 'dublin', title: 'king in Dublin', minFame: 150 },
  home: { place: 'home_fjord', title: 'jarl in Hordaland', lord: 'jarl', minFame: 150 },
  walcheren: { place: 'walcheren', title: 'count of Walcheren', minFame: 150 },
};

export interface RuleState { seat: Seat; since: number; seen: number }

function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The year the jarl in Hordaland dies, fixed for each life. */
export function jarlDies(state: GameState): number {
  const [a, b] = RULE.jarlDies;
  return a + (hashOf(`${state.seed}:jarl`) % (b - a + 1));
}

/** Who stands against him for the seat, and his claim. */
export function rivalOf(state: GameState, content: ContentBundle, seat: Seat): { name: string; claim: number; legend?: string } {
  const year = dateOf(state.day).year;
  switch (seat) {
    case 'orkney': return { name: 'Sigurðr, Harek\'s sister\'s son', claim: 170 };
    case 'dublin':
      if (year < 845) return { name: 'Turgeis', claim: legendClaim(state, content, 'turgeis', year), legend: 'turgeis' };
      // the brother who lost the thing in 834 went to Ireland; else the loud Rogalander from the fort's first winter
      return state.flags.fr_jarl_eirik ? { name: 'Hákon Eysteinsson', claim: 180 } : state.flags.fr_jarl_hakon ? { name: 'Eiríkr Eysteinsson', claim: 180 } : { name: 'Bárðr the Rogalander', claim: 170 };
    case 'home': return { name: 'young Eysteinn, the jarl\'s son', claim: 180 };
    case 'walcheren': return { name: 'Rorik', claim: legendClaim(state, content, 'rorik', year), legend: 'rorik' };
  }
}

/** A legend's claim: half his fame as men tell it, and his fleet. */
function legendClaim(state: GameState, content: ContentBundle, id: string, year: number): number {
  return Math.round(RULE.legendBase + RULE.perFame * legendFame(state, content.rivals[id]!, year));
}

/** His claim, part by part: what the thing will weigh. */
export function claimParts(state: GameState, content: ContentBundle, seat: Seat): { label: string; n: number }[] {
  const d = SEAT_DEF[seat];
  const parts: { label: string; n: number }[] = [
    { label: 'your name', n: Math.round(livingFame(state) * RULE.perFame) },
    { label: 'your men', n: Math.round((state.crew.men + aliveMen(state).length) * RULE.perMan) },
  ];
  if (d.lord) parts.push({ label: `${lordName(state, content, d.lord)}'s favour`, n: Math.max(0, lordFav(state, d.lord)) * RULE.perFavour });
  if (d.place !== 'home_fjord') parts.push({ label: 'what they think of you there', n: Math.max(0, standing(state, content, d.place)) * RULE.perStanding });
  if (seat === 'orkney' && state.flags.wife_ingibjorg) parts.push({ label: 'Harek\'s daughter for your wife', n: RULE.kin });
  if (seat === 'home' && state.base.level === 'hall') parts.push({ label: 'a hall of your own', n: RULE.land });
  if (seat !== 'home' && holdingAt(state, d.place)) parts.push({ label: 'land of your own there', n: RULE.land });
  if (seat === 'dublin' && state.flags.ir_fort_lord) parts.push({ label: 'the high seat of the ship-fort', n: RULE.land });
  return parts.filter((p) => p.n > 0);
}

export function claim(state: GameState, content: ContentBundle, seat: Seat): number {
  return claimParts(state, content, seat).reduce((n, p) => n + p.n, 0);
}

/** His claim less the rival's: what the condition path claim.<seat> reads. */
export function claimMargin(state: GameState, content: ContentBundle, seat: Seat): number {
  return claim(state, content, seat) - rivalOf(state, content, seat).claim;
}

/** The seat is open to a claim now. */
export function seatOpen(state: GameState, content: ContentBundle, seat: Seat): boolean {
  if (state.rule || state.flags[`ru_${seat}_lost`]) return false;
  const year = dateOf(state.day).year;
  const d = SEAT_DEF[seat];
  if (livingFame(state) < d.minFame) return false;
  if (!tied(state, content, seat)) return false;
  switch (seat) {
    case 'orkney': { const dies = lordDies(state, content, 'harek'); return dies !== null && year >= dies; }
    case 'dublin': return !!state.places.dublin?.norse && (year >= 845 || !lordAlive(state, content, 'turgeis') || claimMargin(state, content, 'dublin') > 0);
    case 'home': return year >= jarlDies(state) && !state.flags.outlawed;
    case 'walcheren': return year >= 841;
  }
}

/** A claim needs a tie to the place: a stranger, however famous, is not asked (docs/FRAME-WORLD.md §E). */
export function tied(state: GameState, content: ContentBundle, seat: Seat): boolean {
  switch (seat) {
    case 'orkney': return swornTo(state, 'harek') || lordFav(state, 'harek') >= RULE.tieFavour || !!state.flags.wife_ingibjorg;
    case 'dublin': return !!state.flags.ir_fort_member || !!holdingAt(state, 'dublin') || !!holdingAt(state, 'linn_duachaill');
    case 'home': return lordFav(state, 'jarl') >= RULE.tieFavour || state.base.level === 'hall';
    case 'walcheren': return standing(state, content, 'walcheren') >= 0;
  }
}

/** The words for the claim, for the scene: "Your claim: 140 (your name 96, your men 22, ...). Sigurðr's: 170." */
export function claimWords(state: GameState, content: ContentBundle, seat: Seat): string {
  const parts = claimParts(state, content, seat);
  const r = rivalOf(state, content, seat);
  return `Your claim: ${claim(state, content, seat)} (${parts.map((p) => `${p.label} ${p.n}`).join(', ')}). ${r.name}'s: ${r.claim}${r.legend ? ', his name on every beach' : ''}.`;
}

export function ruleTitle(state: GameState): string | null {
  return state.rule ? SEAT_DEF[state.rule.seat].title : null;
}

/** He takes the seat. */
export function takeSeat(state: GameState, content: ContentBundle, seat: Seat): void {
  const d = SEAT_DEF[seat];
  state.rule = { seat, since: state.day, seen: dateOf(state.day).year };
  state.flags[`ru_${seat}`] = 1;
  const ps = state.places[d.place];
  if (ps && d.place !== 'home_fjord') ps.standing = Math.max(ps.standing ?? 0, 8);
  addDeed(state, content, { type: 'deed', text: `Was made ${d.title}`, weight: RULE.deed, witnesses: 1000 });
  journal(state, `Made ${d.title}.`);
  // a legend who wanted it, and didn't get it, is the smaller for it
  const r = rivalOf(state, content, seat);
  if (r.legend) (state.legends ??= {})[r.legend] = (state.legends[r.legend] ?? 0) - 20;
}

export function loseSeat(state: GameState, content: ContentBundle, why: string): string[] {
  if (!state.rule) return [];
  const seat = state.rule.seat;
  const d = SEAT_DEF[seat];
  delete state.rule;
  delete state.flags[`ru_${seat}`];
  state.flags[`ru_${seat}_lost`] = 1;
  journal(state, `Lost the seat: ${d.title} no longer.`);
  void content;
  return [why];
}

/** The turn of the year for a ruler: tribute, men, being seen, and whether a rival comes. */
export function ruleYear(state: GameState, content: ContentBundle, rng: RngCursor, wintered: string | null): string[] {
  const r = state.rule;
  if (!r) return [];
  const d = SEAT_DEF[r.seat];
  const year = dateOf(state.day).year;
  if (wintered === d.place) r.seen = year;
  if (year - r.seen > RULE.absent) {
    const rv = rivalOf(state, content, r.seat);
    return loseSeat(state, content, `You have not been seen at ${content.places[d.place]!.name} for ${plural(year - r.seen, 'winter')}. ${rv.name} sits in the high seat now, and the people who were yours have stopped saying your name at the door.`);
  }
  state.silver += RULE.tribute;
  earn(state, RULE.tribute);
  state.musterPool += RULE.men;
  const lines = [`As ${d.title}, your tribute comes in: ${formatSilver(RULE.tribute)}, and ${plural(RULE.men, 'man', 'men')} more at the muster.`];
  // the legends' years (docs/FRAME-WORLD.md §B): the Danes at Dublin in 851, Rorik's fleet in 850
  if (r.seat === 'dublin' && year === 851) state.queue.push({ scene: 'ru_danes', day: state.day });
  else if (r.seat === 'walcheren' && year === 850) state.queue.push({ scene: 'ru_rorik', day: state.day });
  else if (rng.float() < RULE.challenge) state.queue.push({ scene: 'ru_challenge', day: state.day });
  return lines;
}
