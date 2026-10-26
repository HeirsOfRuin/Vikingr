// Crew banter (FRAME-PHASE2 §4.6): short lines from the men, picked by who is alive and what has happened.
import type { BanterLine, ContentBundle } from '../content/schema';
import type { GameState } from './state';
import type { RngCursor } from './rng';
import { test } from './conditions';
import { renderText } from './text';

/** One line for this moment, or null. Lines already heard this year are skipped while others remain. */
export function banter(state: GameState, content: ContentBundle, rng: RngCursor, when: BanterLine['when'], chance = 1): string | null {
  if (rng.float() >= chance) return null;
  const alive = new Set(state.men.filter((m) => m.alive).map((m) => m.id));
  const ok = content.banter.map((b, i) => ({ b, i })).filter(({ b }) => b.when === when && alive.has(b.who) && test(b.requires, state, content));
  if (!ok.length) return null;
  // a line that names a dead man (another man in it, or the bench-heir who took his name) is not said
  // (npm run continuity: "Ulf asks Hallvard what the gulls are saying", after Hallvard fell)
  const said = ok.map((o) => ({ ...o, text: renderText(o.b.text, state, content).trim() })).filter((o) => !namesDead(state, o.text));
  if (!said.length) return null;
  const fresh = said.filter(({ i }) => state.flags[`_banter${i}`] === undefined);
  const pool = fresh.length ? fresh : said;
  const pick = pool[rng.int(pool.length)]!;
  state.flags[`_banter${pick.i}`] = state.day;
  return pick.text;
}

/** Whether a line names a man who is dead (and whose name no living man bears). */
export function namesDead(state: GameState, text: string): boolean {
  const living = new Set(state.men.filter((m) => m.alive).map((m) => m.name));
  return state.men.some((m) => !m.alive && !living.has(m.name) && new RegExp(`(?<!\\p{L})${m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\p{L})`, 'u').test(text));
}
