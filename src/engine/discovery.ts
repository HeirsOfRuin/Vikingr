// Discovery (FRAME-FOUNDATION §1): rumours of far places from the old sailors, and what an expedition needs.
import { tradeNewsLine } from './trade';
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
  const year = dateOf(state.day).year;
  return (content.places[at]?.rumours ?? []).filter((id) => !state.known.includes(id) && !state.rumoured.includes(id) && (content.places[id]?.from ?? 0) <= year);
}

/** Halls, markets and towns have old sailors; once a year per port, while they still have something to tell. */
export function listenable(state: GameState, content: ContentBundle, at: string): boolean {
  const p = content.places[at];
  if (!p || !['hall', 'market', 'town', 'home', 'island'].includes(p.kind)) return false;
  if (state.places[at]?.listened === dateOf(state.day).year) return false;
  return untold(state, content, at).length > 0 || (!!p.trade && tradeNewsLine(state, content) !== null);
}

/** The old men talk. Lore and wits decide whether anything true comes out of it. */
export function listen(state: GameState, content: ContentBundle, rng: RngCursor, at: string): string[] {
  const ps = state.places[at]!;
  ps.listened = dateOf(state.day).year;
  const left = untold(state, content, at);
  const chance = Math.min(0.9, 0.45 + 0.07 * (state.hero.skills.lore + effAttr(state, content, 'wit')));
  const news = tradeNewsLine(state, content);
  if (!left.length || rng.float() >= chance) {
    if (news) return [`You stand the old men a round. Most of what they say is about sea-serpents and a woman in Dublin. But one of them has been trading all summer. ${news} The ale was ${formatSilver(LISTEN_COST)}.`];
    return [`You stand the old men a round, and then another, and they tell you about sea-serpents, and a woman in Dublin, and the time they nearly drowned. None of it is any use. The ale was ${formatSilver(LISTEN_COST)}.`];
  }
  const id = left[0]!;
  const p = content.places[id]!;
  state.rumoured.push(id);
  journal(state, `Heard of ${p.name} from the old sailors at ${content.places[at]!.name}.`);
  const out = [`An old man with one eye and a cup in each hand tells you of ${p.name}.`, p.rumour ?? p.desc];
  const road = content.legs.find((l) => !l.expedition && (l.a === id || l.b === id) && state.known.includes(l.a === id ? l.b : l.a));
  const from = road ? content.places[road.a === id ? road.b : road.a]!.name : null;
  out.push(!p.active
    ? 'It is a long way beyond anywhere you could take a ship this year. But it is on your map now, faint, where he said it would be.'
    : from
      ? `He tells you the way, too: from ${from}, ${road!.days} days, ${road!.kind === 'open' ? 'over open sea' : road!.kind === 'river' ? 'up the river and over the portage' : 'along the coast'}. It is on your map now.`
      : 'Nobody you know has the way there; it would take an expedition to find it. It is on your map now, faint, where he said it would be.');
  if (news) out.push(news);
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
