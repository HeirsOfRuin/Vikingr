// Setting a course (docs/FRAME-PACING.md, option 1): one tap sails to any known port by the shortest known
// road, leg by leg, through the same voyage engine. It stops when something happens: a scene at sea or ashore,
// a fight, a storm that sinks a ship, or not enough food for the next leg. The course is remembered, so
// "hold your course" picks it up again.
import type { ContentBundle } from '../content/schema';
import type { GameState } from './state';
import type { RngCursor } from './rng';
import { routes, runVoyage, startVoyage } from './voyage';
import { mouths } from './crew';
import { plural } from './format';

interface Tree { dist: Record<string, number>; prev: Record<string, string> }
const trees = new Map<string, Tree>();

/** Every shortest known road out of one place (Dijkstra over known sea roads, once). The roads depend only on
 *  what he knows, whether he is exiled, and the fleet's speed, so the tree is kept until one of those changes
 *  (the review: course plotting was a third of the engine's time, a search per port, every screen). */
function courseTree(state: GameState, content: ContentBundle, from: string): Tree {
  const first = routes(state, content, from)[0];
  const key = `${from}|${first ? first.days / first.leg.days : 0}|${state.flags.outlawed ?? 0}|${state.flags.outlaw_ended ?? 0}|${state.known.join(',')}|${state.rumoured.join(',')}`;
  const hit = trees.get(key);
  if (hit) return hit;
  const prev: Record<string, string> = {};
  const dist: Record<string, number> = { [from]: 0 };
  const open = [from];
  const done = new Set<string>();
  while (open.length) {
    open.sort((a, b) => dist[a]! - dist[b]!);
    const cur = open.shift()!;
    done.add(cur);
    for (const r of routes(state, content, cur)) {
      if (r.leg.expedition || done.has(r.to)) continue;
      const d = dist[cur]! + r.days;
      if (dist[r.to] === undefined || d < dist[r.to]!) {
        dist[r.to] = d;
        prev[r.to] = cur;
        if (!open.includes(r.to)) open.push(r.to);
      }
    }
  }
  const t = { dist, prev };
  if (trees.size > 400) trees.clear();
  trees.set(key, t);
  return t;
}

/** The shortest known road from here to there, as the places in order (not counting here), and its days. */
export function coursePath(state: GameState, content: ContentBundle, from: string, to: string): { path: string[]; days: number } | null {
  if (from === to) return null;
  const { dist, prev } = courseTree(state, content, from);
  if (dist[to] === undefined) return null;
  const path: string[] = [];
  for (let cur = to; cur !== from; cur = prev[cur]!) path.unshift(cur);
  return { path, days: Math.round(dist[to]! * 10) / 10 };
}

/** Places a course can be set for from here: known, reachable by known roads, and more than one leg away. */
export function courseTargets(state: GameState, content: ContentBundle): { to: string; days: number; legs: number }[] {
  const at = state.at;
  if (!at || state.service || !state.ships.length) return [];
  const out: { to: string; days: number; legs: number }[] = [];
  for (const id of state.known) {
    if (id === at || !content.places[id]?.active) continue;
    const c = coursePath(state, content, at, id);
    if (c && c.path.length > 1) out.push({ to: id, days: c.days, legs: c.path.length });
  }
  return out.sort((a, b) => a.days - b.days);
}

/** Why the first leg can't be sailed now, or null: the same test that stops a course on the road. */
export function courseBlock(state: GameState, content: ContentBundle, hop: string): string | null {
  const legDays = routes(state, content, state.at!).find((r) => r.to === hop)?.days ?? 1;
  return state.provisions < mouths(state) * Math.ceil(legDays) ? `Not enough food for the first leg, to ${content.places[hop]!.name}.` : null;
}

/** Sails the course leg by leg until he gets there, or something happens. */
export function sailCourse(state: GameState, content: ContentBundle, rng: RngCursor): string[] {
  const lines: string[] = [];
  let legs = 0;
  while (state.course && state.at && !state.pending && state.hero.alive) {
    if (state.at === state.course) { delete state.course; break; }
    const c = coursePath(state, content, state.at, state.course);
    if (!c) { lines.push(`There is no road you know from here to ${content.places[state.course]!.name}.`); delete state.course; break; }
    const hop = c.path[0]!;
    if (courseBlock(state, content, hop)) {
      lines.push(`Food for ${plural(Math.floor(state.provisions / Math.max(1, mouths(state))), 'day')}: not enough for the next leg, to ${content.places[hop]!.name}. The course waits until the ships are fed.`);
      break;
    }
    startVoyage(state, content, hop);
    const r = runVoyage(state, content, rng);
    legs += 1;
    lines.push(...r.lines);
    if (!r.arrived) break;
  }
  if (state.course && state.at === state.course) delete state.course;
  if (legs > 1 && !state.course && state.at) lines.unshift(`${plural(legs, 'leg')} of the road behind you.`);
  return lines;
}
