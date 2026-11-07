// Sailing in a great fleet (docs/FRAME-FLEET-843.md §2). Sixty ships are not one ship: the voyage goes at the
// fleet's pace, a lone raider doesn't come for them, a storm scatters them and the fleet gathers again at the
// meeting-place, and the fleet has its own life at sea and in camp. An oarsman hears what the fleet council decided;
// a captain sits in it, and his voice counts by his ships and his name.
import type { ContentBundle } from '../content/schema';
import type { GameState } from './state';
import { dateOf } from './calendar';
import { journal } from './journal';
import { livingFame } from './fame';

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
} as const;

/** `camp`: where an army that lives on land winters (docs/FRAME-865.md); a captain in it may winter there too. */
export interface FleetState {
  id: string;
  since: number;
  camp?: string;
  /** A captain who has taken his ships off from the army's camp on his own account (playtest 2026-11-07). */
  away?: boolean;
}

/** The army's winter camp, if he is with an army that keeps one. */
export function armyCamp(state: GameState): string | undefined {
  return state.fleet?.camp;
}

export function inFleet(state: GameState): boolean {
  return !!state.fleet;
}

/** With the fleet now: sworn to it, and not off on his own. An oarsman goes where his captain goes. */
export function withFleet(state: GameState): boolean {
  return !!state.fleet && (!!state.service || !state.fleet.away);
}

/** A captain in an army that keeps a camp sets out for somewhere else: the army stays, he goes alone. */
export function leaveArmy(state: GameState, content: ContentBundle, dest: string | null): string | null {
  const f = state.fleet;
  if (!f?.camp || state.service || f.away || dest === f.camp) return null;
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
  journal(state, `Sailed with ${f.name}.`);
}

export function leaveFleet(state: GameState, content: ContentBundle): void {
  if (!state.fleet) return;
  journal(state, `Parted from ${fleetName(state, content)}.`);
  delete state.fleet;
}

/** The turn of the year: a fleet past its year breaks up. */
export function fleetYear(state: GameState, content: ContentBundle): string[] {
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
