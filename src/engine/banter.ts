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
  // a line for a temperament is said by a living sworn man of it (docs/FRAME-CREW.md); {man} names him
  const speaker = (b: BanterLine) => (typeof b.who === 'string' ? (alive.has(b.who) ? b.who : null) : pickSpeaker(state, rng, b.who.temperament));
  const ok = content.banter.map((b, i) => ({ b, i, who: speaker(b) })).filter(({ b, who }) => b.when === when && who && test(b.requires, state, content));
  if (!ok.length) return null;
  // a line that names a dead man (another man in it, or the bench-heir who took his name) is not said
  // (npm run continuity: "Ulf asks Hallvard what the gulls are saying", after Hallvard fell)
  const keep = state.mfocus;
  const said = ok.map((o) => { state.mfocus = o.who; const text = renderText(o.b.text, state, content).trim(); return { ...o, text }; }).filter((o) => !namesDead(state, o.text));
  state.mfocus = keep;
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

/** A living sworn man of this temperament to say a line, or null. */
function pickSpeaker(state: GameState, rng: RngCursor, temperament: string): string | null {
  const men = state.men.filter((m) => m.alive && m.sworn && m.temperament === temperament);
  return men.length ? men[rng.int(men.length)]!.id : null;
}
