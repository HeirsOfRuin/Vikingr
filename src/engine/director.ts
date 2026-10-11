// Scene selection (from Knight of Adalia, reshaped for a map game):
// queued scenes first, then scenes bound to a trigger: arriving at a place,
// a day at sea, the start of a phase, an action in the hall.
import type { ContentBundle, Scene } from '../content/schema';
import type { GameState } from './state';
import type { RngCursor } from './rng';
import { test } from './conditions';

export type Trigger = 'arrive' | 'sea' | 'phase_start' | 'hall';

function eligible(s: Scene, state: GameState, content: ContentBundle, trigger: Trigger): boolean {
  if (s.trigger !== trigger) return false;
  if (s.once && state.seen[s.id] !== undefined) return false;
  if (s.cooldown_days !== undefined && state.seen[s.id] !== undefined && state.day - state.seen[s.id]! < s.cooldown_days) return false;
  if (s.phase && !s.phase.includes(state.phase)) return false;
  if (s.at && (!state.at || !s.at.includes(state.at))) return false;
  if (s.at_kind && (!state.at || !s.at_kind.includes(content.places[state.at]!.kind))) return false;
  return test(s.requires, state, content);
}

/** Opens a scene for this trigger, if one is due. Returns true when one was opened. */
export function trigger(state: GameState, content: ContentBundle, rng: RngCursor, t: Trigger): boolean {
  if (state.pending || !state.hero.alive) return false;
  if (fireQueued(state, content)) return true;
  const pool = Object.values(content.scenes).filter((s) => eligible(s, state, content, t));
  // place and phase scenes always fire when eligible; pool scenes roll their chance
  const sure = pool.filter((s) => s.chance === undefined);
  const pick = sure.length ? rng.pickWeighted(sure, (s) => s.weight ?? 1) : rng.pickWeighted(pool.filter((s) => rng.float() < (s.chance ?? 0)), (s) => s.weight ?? 1);
  if (!pick) return false;
  open(state, pick.id);
  return true;
}

export function fireQueued(state: GameState, content: ContentBundle): boolean {
  if (state.pending) return false;
  const due = state.queue.findIndex((q) => q.day <= state.day && test(content.scenes[q.scene]?.requires, state, content));
  if (due < 0) return false;
  const [q] = state.queue.splice(due, 1);
  open(state, q!.scene);
  return true;
}

export function open(state: GameState, id: string): void {
  state.pending = { t: 'scene', id };
  state.seen[id] = state.day;
}
