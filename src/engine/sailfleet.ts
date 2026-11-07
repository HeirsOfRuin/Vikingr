// Sailing in a great fleet (docs/FRAME-FLEET-843.md §2). Sixty ships are not one ship: the voyage goes at the
// fleet's pace, a lone raider doesn't come for them, a storm scatters them and the fleet gathers again at the
// meeting-place, and the fleet has its own life at sea and in camp. An oarsman hears what the fleet council decided;
// a captain sits in it, and his voice counts by his ships and his name.
import type { ContentBundle, CourseStage } from '../content/schema';
import type { GameState } from './state';
import { dateOf, dayOf } from './calendar';
import { test } from './conditions';
import { journal } from './journal';
import { livingFame } from './fame';
import { endOwnFleet } from './ownfleet';
import { plural } from './format';

export const FLEET = {
  /** A fleet sails at the pace of its slower ships. */
  pace: 0.85,
  /** In a storm, a ship can't founder: her hull goes no lower than this; the others pick up who goes over. */
  hullFloor: 8,
  /** Of the men washed overboard in a storm, the share other ships pick up. */
  rescued: 0.7,
  /** A captain's weight at the council: his ships, and his name. */
  voiceShips: 1,
  voiceFame: 1 / 40,
  /** Leaving a fleet on its course. */
  desertHonour: 2,
} as const;

/** Where the fleet is and what it is doing (docs/FRAME-FLEETS-REALMS.md, Part A).
 *  `camp`: where it lies, or the place it is bound for. Lying, a captain may sail off on his own and come back;
 *  bound, he follows it or leaves it. `moved`: the day the fleet last moved, by a scene or by its timetable. */
export interface FleetState {
  id: string;
  since: number;
  camp?: string;
  posture?: 'lying' | 'bound';
  moved?: number;
  /** A captain who has taken his ships off from the fleet on his own account (playtest 2026-11-07). */
  away?: boolean;
  /** His own fleet: the ships that answered his war-arrow (src/engine/ownfleet.ts). */
  own?: import('./ownfleet').OwnFleet;
}

/** The stage of the fleet's course it should be at today, from its timetable (the latest begun whose condition holds). */
export function courseStage(state: GameState, content: ContentBundle): CourseStage | null {
  const course = state.fleet ? content.fleets[state.fleet.id]?.course : undefined;
  if (!course) return null;
  let best: CourseStage | null = null;
  for (const st of course) {
    if (dayOf(st.from[0], st.from[1]) > state.day) continue;
    if (st.requires && !test(st.requires, state, content)) continue;
    if (!best || dayOf(st.from[0], st.from[1]) >= dayOf(best.from[0], best.from[1])) best = st;
  }
  return best;
}

/** The fleet sets out for a place, or lies at one. He is there already: it has arrived. */
export function moveFleet(state: GameState, to: string, posture: 'lying' | 'bound', day = state.day): void {
  const f = state.fleet;
  if (!f) return;
  f.camp = to;
  f.posture = state.at === to && !state.voyage ? 'lying' : posture;
  f.moved = day;
  if (state.at === to && !state.voyage) delete f.away;
}

/** He reaches the place the fleet was bound for, with it: it lies there now. */
export function fleetArrived(state: GameState, at: string): void {
  const f = state.fleet;
  if (f && f.camp === at && f.posture === 'bound' && !f.away) f.posture = 'lying';
}

/** Once a day: the timetable catches up a fleet whose story has gone on without him. Returns news, if he is away. */
export function tickFleet(state: GameState, content: ContentBundle): string[] {
  const f = state.fleet;
  if (!f) return [];
  const st = courseStage(state, content);
  if (!st) return [];
  const from = dayOf(st.from[0], st.from[1]);
  if (from <= (f.moved ?? f.since)) return [];
  // at another man's oar he goes where his captain goes; the fleet's place is kept for the map
  if (state.service) { f.camp = st.at; f.posture = st.posture; f.moved = from; return []; }
  const was = f.camp;
  const name = fleetName(state, content).replace(/^./, (c) => c.toUpperCase());
  if (was === st.at) { f.moved = from; if (st.posture === 'lying' && f.posture === 'bound' && state.at === st.at) f.posture = 'lying'; return []; }
  moveFleet(state, st.at, st.posture, from);
  const there = content.places[st.at]?.name ?? st.at;
  if (f.away) {
    journal(state, `${name} moved to ${there} while he was away.`);
    return [`Word comes: ${name.charAt(0).toLowerCase()}${name.slice(1)} has ${st.posture === 'bound' ? `set out for ${there}` : `gone to ${there}`}${was ? `, and left ${content.places[was]?.name ?? was} empty` : ''}. ${st.note ?? ''}`.trim()];
  }
  // with it, and it is lying somewhere he isn't: he has let it go on without him
  if (st.posture === 'lying' && state.at !== st.at && !state.voyage) {
    f.away = true;
    journal(state, `${name} went on to ${there} without him.`);
    return [`${name} has gone on to ${there} without you. ${st.note ?? ''}`.trim()];
  }
  return [];
}

/** The army's winter camp, if he is with an army that keeps one. */
export function armyCamp(state: GameState): string | undefined {
  return state.fleet?.camp;
}

/** The fleet is bound somewhere, and he is with it and not there yet: he follows it, or leaves it. */
export function fleetBound(state: GameState): string | null {
  const f = state.fleet;
  if (!f || state.service || f.away || f.own || f.posture !== 'bound' || !f.camp || state.at === f.camp) return null;
  return f.camp;
}

export function inFleet(state: GameState): boolean {
  return !!state.fleet;
}

/** With the fleet now: sworn to it, and not off on his own. An oarsman goes where his captain goes. */
export function withFleet(state: GameState): boolean {
  return !!state.fleet && (!!state.service || !!state.fleet.own || !state.fleet.away);
}

/** A captain in an army that keeps a camp sets out for somewhere else: the army stays, he goes alone. */
export function leaveArmy(state: GameState, content: ContentBundle, dest: string | null): string | null {
  const f = state.fleet;
  if (!f?.camp || state.service || f.away || f.own || dest === f.camp) return null;
  // bound and following, the fleet's road is his road
  if (f.posture === 'bound') return null;
  f.away = true;
  const camp = content.places[f.camp]?.name ?? f.camp;
  journal(state, `Took his ships away from ${fleetName(state, content)} on his own account.`);
  return `${fleetName(state, content).replace(/^./, (c) => c.toUpperCase())} stays at ${camp}. You go on your own account: no fleet around you if the weather turns, and no one to come if you meet trouble. Its business goes on without you until you come back to it.`;
}

/** He comes back to the army's camp. */
export function rejoinArmy(state: GameState, content: ContentBundle, at: string): string | null {
  const f = state.fleet;
  if (!f?.away || at !== f.camp) return null;
  delete f.away;
  if (f.posture === 'bound') f.posture = 'lying';
  journal(state, `Rejoined ${fleetName(state, content)} at ${content.places[at]?.name ?? at}.`);
  return `You come back to ${fleetName(state, content)} at ${content.places[at]?.name ?? at}, and take your place in the camp again.`;
}

export function fleetName(state: GameState, content: ContentBundle): string {
  return state.fleet ? content.fleets[state.fleet.id]?.name ?? 'the fleet' : 'the fleet';
}

export function fleetLeader(state: GameState, content: ContentBundle): string {
  return state.fleet ? content.fleets[state.fleet.id]?.leader ?? 'the leader' : 'the leader';
}

export function joinFleet(state: GameState, content: ContentBundle, id: string): void {
  const f = content.fleets[id];
  if (!f) return;
  state.fleet = { id, since: state.day };
  // where it is today: its timetable's stage, or here
  const st = courseStage(state, content);
  if (st) moveFleet(state, st.at, st.posture);
  else if (state.at) moveFleet(state, state.at, 'lying');
  journal(state, `Sailed with ${f.name}.`);
}

/** He leaves the fleet for good. Bound, it is desertion: honour, and the men who stay will say so. */
export function desertFleet(state: GameState, content: ContentBundle): string[] {
  const f = state.fleet;
  if (!f) return [];
  const bound = f.posture === 'bound' && !f.away;
  const name = fleetName(state, content);
  if (bound) state.honour -= FLEET.desertHonour;
  journal(state, bound ? `Deserted ${name}.` : `Left ${name} for good.`);
  delete state.fleet;
  return bound
    ? [`You put your steering-oar over and leave ${name} on its course. Nobody tries to stop you. Every ship you pass watches you go, and every man in them will tell it, the same way: that you left.`]
    : [`You let ${name} go on without you, and go your own way.`];
}

export function leaveFleet(state: GameState, content: ContentBundle): void {
  if (!state.fleet) return;
  journal(state, `Parted from ${fleetName(state, content)}.`);
  delete state.fleet;
}

/** The turn of the year: a fleet past its year breaks up. */
export function fleetYear(state: GameState, content: ContentBundle): string[] {
  // his own fleet: it winters with him if he asked it to, or breaks up
  const own = state.fleet?.own;
  if (own) {
    if (own.winter) { delete own.winter; own.lastAction = state.day; return [`Your fleet has wintered with you: ${plural(own.ships, 'ship')} still beside your own, and their captains waiting to hear where this summer goes.`]; }
    return endOwnFleet(state, content);
  }
  const f = state.fleet ? content.fleets[state.fleet.id] : undefined;
  if (!f || dateOf(state.day).year <= f.until) return [];
  const name = f.name;
  delete state.fleet;
  return [`${name.charAt(0).toUpperCase()}${name.slice(1)} breaks up at the turn of the year: some ships for home, some for other men's summers.`];
}

/** His voice at the council: 0 for an oarsman; ships and fame for a captain. */
export function councilVoice(state: GameState): number {
  if (state.service) return 0;
  return Math.round((state.ships.length * FLEET.voiceShips + livingFame(state) * FLEET.voiceFame) * 10) / 10;
}
