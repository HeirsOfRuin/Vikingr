// Discovery (FRAME-FOUNDATION §1): rumours of far places from the old sailors, and what an expedition needs.
import type { ContentBundle } from '../content/schema';
import type { GameState } from './state';
import type { RngCursor } from './rng';
import { dateOf } from './calendar';
import { journal } from './journal';
import { effAttr } from './hero';
import { mouths } from './crew';
import { EXPEDITION } from './tuning';
import { formatSilver } from './format';

/** A round of ale for the old men at the fire. */
export const LISTEN_COST = 2;

/** Far places this port's sailors could still tell him of. */
function untold(state: GameState, content: ContentBundle, at: string): string[] {
  return (content.places[at]?.rumours ?? []).filter((id) => !state.known.includes(id) && !state.rumoured.includes(id));
}

/** Halls, markets and towns have old sailors; once a year per port, while they still have something to tell. */
export function listenable(state: GameState, content: ContentBundle, at: string): boolean {
  const p = content.places[at];
  if (!p || !['hall', 'market', 'town', 'home', 'island'].includes(p.kind)) return false;
  if (state.places[at]?.listened === dateOf(state.day).year) return false;
  return untold(state, content, at).length > 0;
}

/** The old men talk. Lore and wits decide whether anything true comes out of it. */
export function listen(state: GameState, content: ContentBundle, rng: RngCursor, at: string): string[] {
  const ps = state.places[at]!;
  ps.listened = dateOf(state.day).year;
  const left = untold(state, content, at);
  const chance = Math.min(0.9, 0.45 + 0.07 * (state.hero.skills.lore + effAttr(state, content, 'wit')));
  if (!left.length || rng.float() >= chance) {
    return [`You stand the old men a round, and then another, and they tell you about sea-serpents, and a woman in Dublin, and the time they nearly drowned. None of it is any use. The ale was ${formatSilver(LISTEN_COST)}.`];
  }
  const id = left[0]!;
  const p = content.places[id]!;
  state.rumoured.push(id);
  journal(state, `Heard of ${p.name} from the old sailors at ${content.places[at]!.name}.`);
  const out = [`An old man with one eye and a cup in each hand tells you of ${p.name}.`, p.rumour ?? p.desc];
  out.push(p.active ? 'Nobody you know has the way there. It is on your map now, faint, where he said it would be.' : 'It is a long way beyond anywhere you could take a ship this year. But it is on your map now, faint, where he said it would be.');
  return out;
}

/** Why he can't set out on an expedition yet, or null if he can. */
export function expeditionBlock(state: GameState, content: ContentBundle): string | null {
  if (state.service) return 'It is not your ship.';
  if (state.crew.men < EXPEDITION.minMen) return `You need at least ${EXPEDITION.minMen} men.`;
  if (state.ships.some((s) => s.hull < EXPEDITION.minHull)) return 'Your ship is not sound enough for open water. Refit her first.';
  if (state.provisions < mouths(state) * EXPEDITION.foodDays) return `You need food for ${EXPEDITION.foodDays} days.`;
  void content;
  return null;
}
