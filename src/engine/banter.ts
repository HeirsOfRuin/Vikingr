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
  const fresh = ok.filter(({ i }) => state.flags[`_banter${i}`] === undefined);
  const pool = fresh.length ? fresh : ok;
  const pick = pool[rng.int(pool.length)]!;
  state.flags[`_banter${pick.i}`] = state.day;
  return renderText(pick.b.text, state, content).trim();
}
