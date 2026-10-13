// Boasts sworn over the bragarfull (FRAME-PHASE2 §4.4, FRAME-FOUNDATION §5). The story keeps some by hand
// ({ keep_boast }); the yearly pool's boasts carry a goal the engine checks after every action.
import type { ContentBundle } from '../content/schema';
import type { Boast, GameState } from './state';
import { addDeed } from './fame';
import { journal } from './journal';
import { test } from './conditions';

/** Swear a boast. A repeatable one, once kept or broken, can be sworn again. */
export function swearBoast(state: GameState, content: ContentBundle, id: string): void {
  const def = content.boasts[id]!;
  const old = state.boasts.find((b) => b.id === id);
  if (old && (old.state === 'open' || !def.repeat)) return;
  if (old) state.boasts.splice(state.boasts.indexOf(old), 1);
  const b: Boast = { id, sworn: state.day, due: state.day + def.days, state: 'open' };
  if (def.goal && 'stat' in def.goal) b.base = state.stats[def.goal.stat];
  state.boasts.push(b);
  journal(state, `You swore over the cup: ${def.text}`);
}

export function keepBoast(state: GameState, content: ContentBundle, b: Boast): void {
  b.state = 'kept';
  b.closed = state.day;
  addDeed(state, content, { type: 'boast_kept', text: `Kept his boast: ${content.boasts[b.id]!.text}`, witnesses: state.crew.men });
}

export function breakBoast(state: GameState, content: ContentBundle, b: Boast): void {
  b.state = 'broken';
  b.closed = state.day;
  state.honour = Math.max(-10, state.honour - 2);
  journal(state, `The boast went unkept: ${content.boasts[b.id]?.text}`);
}

/** Has an open boast's goal been reached? */
export function goalMet(state: GameState, content: ContentBundle, b: Boast): boolean {
  const g = content.boasts[b.id]?.goal;
  if (!g || b.state !== 'open') return false;
  if ('stat' in g) return state.stats[g.stat] - (b.base ?? 0) >= g.n;
  return test(g.when, state, content);
}

/** How far along a counted boast is, for the Saga: "2 of 3". */
export function goalProgress(state: GameState, content: ContentBundle, b: Boast): string | null {
  const g = content.boasts[b.id]?.goal;
  if (!g || !('stat' in g) || b.state !== 'open') return null;
  return `${Math.min(g.n, state.stats[g.stat] - (b.base ?? 0))} of ${g.n} so far`;
}

const KEPT = ['You did. The hall bangs the tables.', 'You did, and every man here knows it. The cups go up.', 'Done, and the hall roars it.'];
const BROKEN = ['You did not. The hall goes quiet, the way that is worse than laughing.', 'You did not. Somebody says so, loudly, and nobody tells him to shut up.', 'It went undone. Men look at their cups.'];
const OPEN = ['It is still to come.', 'Not yet. The hall will remember.'];

/** The reckoning at Yule: this year's boasts, kept, broken and still open, as the jarl's man calls them. */
export function reckoning(state: GameState, content: ContentBundle): string {
  const lines: string[] = [];
  let i = 0;
  for (const b of state.boasts) {
    const recent = b.closed !== undefined && state.day - b.closed <= 330;
    if (b.state !== 'open' && !recent) continue;
    const word = b.state === 'kept' ? KEPT[i % KEPT.length] : b.state === 'broken' ? BROKEN[i % BROKEN.length] : OPEN[i % OPEN.length];
    lines.push(`You swore: "${content.boasts[b.id]?.text}" ${word}`);
    i++;
  }
  return lines.length ? lines.join('\n\n') : 'There is nothing of yours to reckon this year. Some men think that is wise. More of them think it is something else.';
}
