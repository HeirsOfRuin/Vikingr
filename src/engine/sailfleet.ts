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

export interface FleetState { id: string; since: number }

export function inFleet(state: GameState): boolean {
  return !!state.fleet;
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
