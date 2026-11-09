// A fleet of your own (docs/FRAME-FLEETS-REALMS.md, Part C). In the winter he sends out the war-arrow; in the spring the
// captains who answer it bring their ships. The fleet is his: it lies where he lies and sails where he sails, its crews
// stand in his line, and it eats plunder. Idle weeks and lost fights wear its cohesion down, and below a point its captains
// start to go home. It breaks up at the year's end, or winters together if he can hold it.
import type { ContentBundle } from '../content/schema';
import type { GameState } from './state';
import type { RngCursor } from './rng';
import { dateOf } from './calendar';
import { livingFame } from './fame';
import { journal } from './journal';
import { plural, formatSilver } from './format';
import { partner } from './allies';

export const OWN = {
  /** Fame to send out the arrow. */
  minFame: 350,
  /** Ships that answer: one for every so much fame, and more for a seat and a partner. */
  famePerShip: 45,
  seatShips: 3,
  partnerShips: 2,
  maxShips: 12,
  menPerShip: 30,
  /** Cohesion, 0-10. */
  start: 6,
  /** A week at anchor doing nothing; days at sea keep a fleet busy. */
  idleWeek: -0.4,
  leaveChance: 0.3,
  won: 1,
  lost: -2,
  /** Below this, a captain goes home at each week's reckoning. */
  leaveBelow: 2.5,
  /** Plunder: the other crews strip the same town alongside his (plunder.ts), and he keeps a captain's share of their part
   *  as the man who called them. Was: they took 15% of his take again per ship, out of nothing, and he kept 40% of that
   *  (Josh's save, 2026-11-09: eight ships put half as much again as every raid's heap straight into his purse). */
  leaderShare: 0.3,
  /** Tribute from a town that sees the fleet: this share of its wealth, scaled by how far the fleet outnumbers its men. */
  tribute: 0.3,
} as const;

export interface OwnFleet { ships: number; men: number; cohesion: number; target?: string; lastAction: number; winter?: boolean }

export function ownFleet(state: GameState): OwnFleet | null {
  return state.fleet?.id === 'own' ? state.fleet.own ?? null : null;
}

/** He can send out the war-arrow: a winter, a name, a ship, and no other fleet. */
export function arrowBlock(state: GameState): string | null {
  if (state.service) return 'You row at another man\'s oar.';
  if (state.fleet) return 'You are sworn to a fleet already.';
  if (state.ships.length < 2) return 'Captains follow a man with ships of his own: two at least.';
  if (livingFame(state) < OWN.minFame) return `Nobody would answer it yet: a name of ${OWN.minFame} at least.`;
  // it goes out from a hall or a high seat: a man with neither has nowhere for the captains to come to
  if (!state.rule && state.base.level !== 'hall') return 'A war-arrow goes out from a hall of your own or a high seat. You have neither.';
  if (state.arrow) return 'The arrow is out already.';
  return null;
}

/** How many ships would answer, if he sent it now. */
export function arrowShips(state: GameState, content: ContentBundle): number {
  const n = Math.floor(livingFame(state) / OWN.famePerShip) + (state.rule ? OWN.seatShips : 0) + (partner(state, content) ? OWN.partnerShips : 0);
  return Math.max(1, Math.min(OWN.maxShips, n));
}

/** The arrow goes out over the winter; the fleet gathers at the spring. */
export function sendArrow(state: GameState, target: string | null): void {
  state.arrow = { target: target ?? undefined, year: dateOf(state.day).year + (dateOf(state.day).doy >= 182 ? 1 : 0) };
  journal(state, 'Sent out the war-arrow.');
}

/** At the spring: the captains who answered. */
export function gatherFleet(state: GameState, content: ContentBundle): string[] {
  const a = state.arrow;
  // the ships come in the spring, after the turn of the year, never in the dark of the winter
  if (!a || dateOf(state.day).year < a.year || state.phase === 'winter') return [];
  delete state.arrow;
  if (state.service || !state.hero.alive) return [];
  const ships = arrowShips(state, content);
  state.fleet = { id: 'own', since: state.day, camp: state.at ?? undefined, posture: 'lying', moved: state.day, own: { ships, men: ships * OWN.menPerShip, cohesion: OWN.start, target: a.target, lastAction: state.day } };
  journal(state, `${plural(ships, 'ship')} answered the war-arrow.`);
  state.queue.push({ scene: 'of_answer', day: state.day });
  return [ships === 1
    ? `One ship answers your war-arrow, with ${OWN.menPerShip} men in her, and her captain is waiting on the beach for you to tell him where.`
    : `${plural(ships, 'ship')} answer your war-arrow, with ${ships * OWN.menPerShip} men in them, and their captains are waiting on the beach for you to tell them where.`];
}

/** His fleet's men who stand in his line, as cohesion holds them. */
export function ownFleetMen(state: GameState): number {
  const f = ownFleet(state);
  if (!f) return 0;
  return Math.round(f.men * Math.min(1, 0.5 + f.cohesion / 12));
}

export function shiftCohesion(state: GameState, n: number): void {
  const f = ownFleet(state);
  if (!f) return;
  f.cohesion = Math.max(0, Math.min(10, f.cohesion + n));
}

/** A fight is over: the fleet takes heart, or doesn't. Its losses are its own. */
export function ownFleetFought(state: GameState, won: boolean, allyLost: number): void {
  const f = ownFleet(state);
  if (!f) return;
  shiftCohesion(state, won ? OWN.won : OWN.lost);
  f.men = Math.max(0, f.men - allyLost);
  f.ships = Math.max(0, Math.min(f.ships, Math.ceil(f.men / OWN.menPerShip)));
  f.lastAction = state.day;
}

/** Plunder taken with the fleet: the other crews take theirs, and he takes a leader's share of it. Returns his extra. */
export function ownFleetPlunder(state: GameState, theirs: number): { extra: number; line: string | null } {
  const f = ownFleet(state);
  theirs = Math.round(theirs);
  if (!f || theirs <= 0) return { extra: 0, line: null };
  const extra = Math.round(theirs * OWN.leaderShare);
  f.lastAction = state.day;
  shiftCohesion(state, 0.5);
  return { extra, line: `Your fleet's crews bring in ${formatSilver(theirs)} more from the town; your share of it, as the man who called them, is ${formatSilver(extra)}.` };
}

/** Each week: idle weeks wear the fleet down, and below a point its captains go home. */
export function tickOwnFleet(state: GameState, content: ContentBundle, rng: RngCursor): string[] {
  const f = ownFleet(state);
  if (!f) return [];
  const lines: string[] = [];
  // at sea, or just come in from it, the fleet is busy
  if (state.voyage || state.cruise || state.phase === 'muster' || state.phase === 'winter') { f.lastAction = state.day; return []; }
  while (state.day - f.lastAction >= 7) {
    f.lastAction += 7;
    shiftCohesion(state, OWN.idleWeek);
    if (f.cohesion < OWN.leaveBelow && f.ships > 0 && rng.float() < OWN.leaveChance) {
      f.ships -= 1;
      f.men = Math.max(0, f.men - OWN.menPerShip);
      const who = captainName(state, content, rng);
      lines.push(`${who} takes his ship home in the night. He leaves a message: a summer sitting on a beach is no summer, and he has a farm.`);
      journal(state, `${who} took his ship home from your fleet.`);
    }
    if (f.ships <= 0) { lines.push(...endOwnFleet(state, content, 'The last of the captains who answered your arrow has gone home. You have no fleet now, only your own ships.')); break; }
  }
  return lines;
}

function captainName(state: GameState, content: ContentBundle, rng: RngCursor): string {
  const names = Object.values(content.captains).map((c) => c.name);
  const pool = ['Ketill Flat-Hand', 'Úlfr of Agder', 'Bersi the Dane', 'Sumarliði', 'Þorgils the Rogalander', 'Grímr Kamban', ...names];
  return pool[Math.floor(rng.float() * pool.length)]!;
}

/** The fleet breaks up: the captains take their ships home. */
export function endOwnFleet(state: GameState, content: ContentBundle, why?: string): string[] {
  const f = ownFleet(state);
  if (!f) return [];
  delete state.fleet;
  journal(state, 'His fleet broke up.');
  void content;
  return [why ?? `Your fleet breaks up. ${plural(f.ships, 'captain')} take${f.ships === 1 ? 's' : ''} ${f.ships === 1 ? 'his ship' : 'their ships'} home with what they took under your arrow, and will tell it.`];
}

/** A town under the fleet's eye pays to be left alone. */
export function tributeOffer(state: GameState, content: ContentBundle, at: string): number {
  const f = ownFleet(state);
  const raid = content.places[at]?.raid;
  if (!f || !raid) return 0;
  const ours = state.crew.men + f.men;
  const scale = Math.min(1, ours / Math.max(1, raid.defenders * 3));
  return Math.round((state.places[at]?.wealth ?? raid.wealth) * OWN.tribute * scale);
}
