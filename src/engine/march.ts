// Overland (Josh's playtest, 2026-10-30: "I chose to ride north with Ragnarr's sons ... and it gave me ship events").
// Some places are reached by road, not by sea: Roman roads and river valleys inland. A march takes days on the road,
// eats from the stores, and fires the place's arrival scenes like a landfall; no sea, so no storms, no sea events.
// The ships: with an army that keeps a camp, or at another man's oar, they go round by water with the fleet.
// Otherwise they stay hauled up where he left them (state.inland), and he must march back to them to sail.
import type { ContentBundle, Leg } from '../content/schema';
import type { GameState } from './state';
import type { RngCursor } from './rng';
import { dateOf } from './calendar';
import { SAILING_DOY } from './tuning';
import { eatDays, hearOfNeighbours } from './voyage';
import { heal } from './hero';
import { journal } from './journal';
import { trigger } from './director';
import { armyCamp } from './sailfleet';
import { plural } from './format';

/** Legs a man can walk: the roads, and the river valleys beside the rivers ships go up. */
const WALKABLE: Leg['kind'][] = ['land', 'river'];

/** Roads out of a place to places on the map: the land legs (a river leg is sailed, unless the ships are left behind). */
export function landRoads(state: GameState, content: ContentBundle, from: string): { to: string; days: number }[] {
  return content.legs
    .filter((l) => (l.a === from || l.b === from) && (l.kind === 'land' || (state.inland && l.kind === 'river')))
    .map((l) => ({ to: l.a === from ? l.b : l.a, days: Math.ceil(l.days) }))
    .filter((r) => content.places[r.to]?.active);
}

/** The shortest walk between two places, by days, along roads and river valleys. */
export function landPath(content: ContentBundle, from: string, to: string): { path: string[]; days: number } | null {
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, string>();
  const open = new Set([from]);
  while (open.size) {
    const cur = [...open].sort((a, b) => dist.get(a)! - dist.get(b)!)[0]!;
    open.delete(cur);
    if (cur === to) break;
    for (const l of content.legs) {
      if (!WALKABLE.includes(l.kind)) continue;
      const nb = l.a === cur ? l.b : l.b === cur ? l.a : null;
      if (!nb || !content.places[nb]?.active) continue;
      const d = dist.get(cur)! + Math.ceil(l.days);
      if (d < (dist.get(nb) ?? Infinity)) { dist.set(nb, d); prev.set(nb, cur); open.add(nb); }
    }
  }
  if (!dist.has(to) || from === to) return null;
  const path: string[] = [];
  for (let c = to; c !== from; c = prev.get(c)!) path.unshift(c);
  return { path, days: dist.get(to)! };
}

/** Do his ships go with him on a march? With an army's fleet, or another man's ship, yes. */
function shipsFollow(state: GameState): boolean {
  return !!state.service || !!armyCamp(state);
}

/** Why he can't march from here, or null. */
export function marchBlock(state: GameState): string | null {
  if (state.voyage) return 'You are at sea.';
  if (!state.at) return 'You are nowhere.';
  return null;
}

/** He marches to `to` by the shortest road. Returns the lines of the march. */
export function march(state: GameState, content: ContentBundle, rng: RngCursor, to: string, how?: string): string[] {
  const from = state.at;
  if (!from || from === to) return [];
  const lp = landPath(content, from, to);
  if (!lp) return [];
  const lines: string[] = [];
  eatDays(state, lp.days);
  state.day += lp.days;
  state.fedTo = state.day;
  heal(state, content, lp.days);
  // months on the road carry him out of the spring muster
  if (state.phase === 'muster' && dateOf(state.day).doy >= SAILING_DOY) state.phase = 'sailing';
  if (!shipsFollow(state) && state.ships.length) {
    if (!state.inland) state.inland = from;
    else if (state.inland === to) delete state.inland;
  }
  state.at = to;
  delete state.marchTo;
  for (const p of lp.path) if (!state.known.includes(p)) state.known.push(p);
  if (state.service && state.service.route[0] === to) state.service.route.shift();
  const place = content.places[to]!;
  lines.push(how ?? `${plural(lp.days, 'day')} on the road${lp.path.length > 1 ? `, by ${lp.path.slice(0, -1).map((p) => content.places[p]!.name).join(' and ')}` : ''}, and you come to ${place.name}.${shipsFollow(state) ? ' The ships come round by water to meet you.' : state.inland ? ` The ships are hauled up at ${content.places[state.inland]!.name}, with a few men to watch them.` : ' The ships are where you left them.'}`);
  const heard = hearOfNeighbours(state, content, to);
  if (heard.length) lines.push(`They tell you of ${heard.map((id) => content.places[id]!.name).join(' and ')}.`);
  journal(state, `Marched to ${place.name}.`);
  trigger(state, content, rng, 'arrive');
  return lines;
}
