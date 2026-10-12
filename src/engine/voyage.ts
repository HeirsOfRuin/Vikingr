// Sailing: the place graph, and legs resolved day by day (wind, provisions,
// storms, encounters). A voyage stops when something happens and resumes after.
import type { ContentBundle, Leg } from '../content/schema';
import type { GameState, Wind } from './state';
import type { RngCursor } from './rng';
import { dateOf } from './calendar';
import { STORM_BY_MONTH, STORM_LEG_MULT, WIND, HUNGER_MORALE_PER_DAY, SEA_EVENTS_PER_LEG } from './tuning';
import { fleetSpeed, mouths, aliveMen, clampMorale } from './crew';
import { effAttr, heal, kill, learn } from './hero';
import { addDeed } from './fame';
import { trigger } from './director';
import { journal } from './journal';
import { plural } from './format';

export interface Route {
  to: string;
  leg: Leg;
  days: number; // expected days at the fleet's speed with average wind
}

const AVG_PROGRESS = WIND.states.reduce((s, w, i) => s + WIND.progress[w] * WIND.weights[i]!, 0);

/** Legs out of a place to places that are on the map in this phase and known to the hero (or to anyone: any). */
export function routes(state: GameState, content: ContentBundle, from: string, any = false): Route[] {
  const speed = fleetSpeed(state, content);
  return content.legs
    .filter((l) => l.a === from || l.b === from)
    .map((leg) => ({ leg, to: leg.a === from ? leg.b : leg.a }))
    .filter((r) => content.places[r.to]?.active && (any || state.known.includes(r.to)))
    .map((r) => ({ ...r, days: Math.round((r.leg.days / (speed * AVG_PROGRESS)) * 10) / 10 }));
}

/** Places next to this one become known: you learn the way onward from the people there. */
export function learnNeighbours(state: GameState, content: ContentBundle, at: string): void {
  for (const l of content.legs) {
    const other = l.a === at ? l.b : l.b === at ? l.a : null;
    if (other && content.places[other]?.active && !state.known.includes(other)) state.known.push(other);
  }
}

export function stormChance(state: GameState, kind: Leg['kind'], wind: Wind): number {
  const m = dateOf(state.day).month;
  const skill = 1 - 0.04 * state.hero.skills.seamanship - 0.02 * state.hamingja;
  return STORM_BY_MONTH[m]! * STORM_LEG_MULT[kind] * (wind === 'gale' ? WIND.galeStormMult : 1) * Math.max(0.3, skill);
}

/** The next place on the shortest sea road from one place to another (by legs, any place on the map). */
export function nextHop(content: ContentBundle, from: string, to: string): string | null {
  if (from === to) return null;
  const prev: Record<string, string> = {};
  const seen = new Set([from]);
  const q = [from];
  while (q.length) {
    const cur = q.shift()!;
    for (const l of content.legs) {
      const nb = l.a === cur ? l.b : l.b === cur ? l.a : null;
      if (!nb || seen.has(nb) || !content.places[nb]?.active) continue;
      seen.add(nb);
      prev[nb] = cur;
      q.push(nb);
    }
  }
  if (!seen.has(to)) return null;
  let cur = to;
  while (prev[cur] !== from) cur = prev[cur]!;
  return cur;
}

/** Sets out for `to`. With any, the way need not be known to the hero (another man is steering), and a far
 *  destination is reached hop by hop: this leg goes to the next place on the road. */
export function startVoyage(state: GameState, content: ContentBundle, to: string, any = false): void {
  const from = state.at!;
  if (any) {
    const hop = nextHop(content, from, to);
    if (!hop) throw new Error(`no sea road from ${from} to ${to}`);
    to = hop;
  }
  const r = routes(state, content, from, any).find((x) => x.to === to);
  if (!r) throw new Error(`no route from ${from} to ${to}`);
  state.voyage = { from, to, kind: r.leg.kind, total: r.leg.days, progress: 0, daysAtSea: 0, wind: 'fair' };
  state.at = null;
}

function rollWind(prev: Wind, rng: RngCursor): Wind {
  if (rng.float() < WIND.persist) return prev;
  return rng.pickWeighted([...WIND.states], (w) => WIND.weights[WIND.states.indexOf(w)]!)!;
}

/** A storm. Ships take damage, men go over the side, and a ship can founder. */
function storm(state: GameState, content: ContentBundle, rng: RngCursor, lines: string[]): void {
  state.stats.storms += 1;
  lines.push('A storm. Black water over the bows, the sail split, men bailing with helmets.');
  state.provisions = Math.round(state.provisions * 0.85);
  let lostMen = 0;
  for (let i = state.ships.length - 1; i >= 0; i--) {
    const ship = state.ships[i]!;
    ship.hull -= Math.max(2, 6 + rng.int(20) - state.hero.skills.seamanship - Math.min(4, state.hero.skills.craft));
    const over = rng.int(3);
    lostMen += over;
    if (ship.hull > 0) continue;
    // she founders
    const aboard = Math.round(state.crew.men / state.ships.length);
    const drowned = Math.round(aboard * 0.7);
    lostMen += drowned;
    state.ships.splice(i, 1);
    lines.push(`${ship.name} breaks up. ${plural(drowned, 'man', 'men')} go down with her.`);
    journal(state, `${ship.name} was lost in a storm.`);
    if (i === 0) {
      for (const m of aliveMen(state)) {
        if (rng.float() < 0.5) {
          m.alive = false;
          m.diedOn = state.day;
          lines.push(`${m.name} is not among the men pulled from the water.`);
          journal(state, `${m.name} drowned.`);
        }
      }
      const survive = 0.35 + 0.05 * effAttr(state, content, 'end') + 0.03 * state.hero.skills.seamanship + 0.02 * state.hamingja;
      if (rng.float() >= survive) {
        kill(state, 'drowned', `${state.hero.name} drowned when ${ship.name} went down.`);
        return;
      }
      lines.push('You come up, and find a spar, and hold on.');
    }
  }
  state.crew.men = Math.max(0, state.crew.men - lostMen);
  state.crew.morale -= 1;
  clampMorale(state);
  if (lostMen) lines.push(`${plural(lostMen, 'man', 'men')} lost to the sea.`);
  const m = dateOf(state.day).month;
  if (m >= 8 || m <= 2 || !state.ships.length) addDeed(state, content, { type: 'storm_survived', text: 'Lived through a storm in the dark of the year', witnesses: state.crew.men });
}

export interface VoyageResult {
  lines: string[];
  arrived: boolean;
}

/** Sails day by day until arrival, an interruption (a scene or a fight), or death. */
export function runVoyage(state: GameState, content: ContentBundle, rng: RngCursor): VoyageResult {
  const lines: string[] = [];
  const v = state.voyage;
  if (!v) return { lines, arrived: false };
  while (state.voyage && !state.pending && state.hero.alive) {
    state.day += 1;
    v.daysAtSea += 1;
    v.wind = rollWind(v.wind, rng);
    v.progress += WIND.progress[v.wind] * fleetSpeed(state, content);
    const eat = mouths(state);
    // at another man's oar, the captain feeds the ship: that is his part of the bargain
    if (state.service) { /* his stores, not the hero's */ }
    else if (state.provisions >= eat) state.provisions -= eat;
    else {
      state.provisions = 0;
      state.stats.hungerDays += 1;
      state.crew.morale -= HUNGER_MORALE_PER_DAY;
      clampMorale(state);
      if (v.daysAtSea % 3 === 1) lines.push('The food is gone. The men row on water and anger.');
    }
    learn(state, 'seamanship', 1);
    heal(state, content, 1, 0.25);
    if (rng.float() < stormChance(state, v.kind, v.wind)) {
      storm(state, content, rng, lines);
      if (!state.hero.alive) return { lines, arrived: false };
      if (!state.ships.length) {
        // washed up where they were going, with what they could hold on to
        arrive(state, content, rng, lines, 'Those who lived drag themselves ashore.');
        return { lines, arrived: true };
      }
    }
    if (v.progress >= v.total || v.daysAtSea > 40) {
      arrive(state, content, rng, lines);
      return { lines, arrived: true };
    }
    if ((v.events ?? 0) < SEA_EVENTS_PER_LEG && trigger(state, content, rng, 'sea')) {
      v.events = (v.events ?? 0) + 1;
      break;
    }
  }
  return { lines, arrived: false };
}

function arrive(state: GameState, content: ContentBundle, rng: RngCursor, lines: string[], how?: string): void {
  const v = state.voyage!;
  state.at = v.to;
  state.voyage = null;
  state.stats.legs += 1;
  learnNeighbours(state, content, v.to);
  const place = content.places[v.to]!;
  if (state.service && state.service.route[0] === v.to) state.service.route.shift();
  if (!state.known.includes(v.to)) state.known.push(v.to);
  lines.push(how ?? `Landfall at ${place.name} after ${plural(v.daysAtSea, 'day')} at sea.`);
  journal(state, `Landfall at ${place.name}.`);
  const d = dateOf(state.day);
  if ((d.month >= 9 || d.month <= 1) && state.flags._late_sail !== d.year) {
    state.flags._late_sail = d.year;
    addDeed(state, content, { type: 'late_sailing', text: `Sailed to ${place.name} in the dark of the year`, witnesses: state.crew.men });
  }
  trigger(state, content, rng, 'arrive');
}
