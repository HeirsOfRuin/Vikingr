// Allies (docs/FRAME-TRADE-ALLIES.md §Step 3): the shipmasters of the north, what they think of him, the
// summer's félag (sworn partnership), and the jarl's favour.
import type { ContentBundle } from '../content/schema';
import type { GameState } from './state';
import { dateOf } from './calendar';
import { journal } from './journal';
import { test } from './conditions';
import { formatSilver } from './format';

export const ALLY = {
  /** A félag is sworn only with a man who thinks this well of him. */
  felagRel: 3,
  /** Below this, a partner may hang back when the shields go up. */
  steadyRel: 4,
  hangBack: 0.25,
  /** A greedy partner below this takes more than his share at the dividing. */
  honestRel: 5,
  greedyExtra: 0.5,
  /** Hold a partner's ships add, per ship, in ørtugar. */
  holdPerShip: 1500,
} as const;
export const FAVOUR = {
  min: -10,
  max: 10,
  /** The jarl's cut for a borrowed ship falls to this at good favour. */
  cutGood: 1 / 6,
  goodAt: 5,
  grantAt: 6,
  badAt: -5,
  giftCost: 48,
  gift: 2,
} as const;

export interface CaptainState { rel: number; met: boolean; alive: boolean }

/** What a captain thinks of him: stored once anything has happened between them, else his start plus the bias of what he's heard. */
export function captain(state: GameState, content: ContentBundle, id: string): CaptainState {
  const s = state.captains?.[id];
  if (s) return s;
  const def = content.captains[id]!;
  const rel = def.rel + (def.bias ?? []).reduce((n, b) => n + (test(b.if, state, content) ? b.n : 0), 0);
  return { rel: Math.max(-10, Math.min(10, rel)), met: false, alive: true };
}

function store(state: GameState, content: ContentBundle, id: string): CaptainState {
  state.captains ??= {};
  return (state.captains[id] ??= { ...captain(state, content, id) });
}

export function meet(state: GameState, content: ContentBundle, id: string): void {
  const c = store(state, content, id);
  if (!c.met) journal(state, `Met ${content.captains[id]!.name}.`);
  c.met = true;
}

export function shiftRel(state: GameState, content: ContentBundle, id: string, n: number): void {
  const c = store(state, content, id);
  c.rel = Math.max(-10, Math.min(10, c.rel + n));
}

export function killCaptain(state: GameState, content: ContentBundle, id: string): void {
  store(state, content, id).alive = false;
  if (state.partner?.id === id) delete state.partner;
}

export function relWord(rel: number): string {
  return rel >= 7 ? 'a friend for life' : rel >= 4 ? 'a friend' : rel >= 1 ? 'well disposed' : rel >= -2 ? 'wary of you' : rel >= -6 ? 'no friend of yours' : 'your enemy';
}

/** His partner this summer, if he has one and the man is alive. */
export function partner(state: GameState, content: ContentBundle): string | null {
  const p = state.partner;
  if (!p || p.year !== dateOf(state.day).year) return null;
  return captain(state, content, p.id).alive ? p.id : null;
}

/** The captain most likely to swear with him: met, alive, and the best disposed, if well enough. */
export function bestAlly(state: GameState, content: ContentBundle): string | null {
  let best: string | null = null;
  let rel = ALLY.felagRel - 1;
  for (const id of Object.keys(content.captains)) {
    const c = captain(state, content, id);
    if (c.met && c.alive && c.rel > rel) { best = id; rel = c.rel; }
  }
  return best;
}

export function swearFelag(state: GameState, content: ContentBundle, id: string): void {
  meet(state, content, id);
  state.partner = { id, year: dateOf(state.day).year, loot: 0 };
  journal(state, `Swore félag with ${content.captains[id]!.name} for the summer.`);
}

/** His partner's men in a fight, unless the man hangs back (lines say which). */
export function partnerInFight(state: GameState, content: ContentBundle, roll: number): { men: number; line: string | null } {
  const id = partner(state, content);
  if (!id || state.service) return { men: 0, line: null };
  const def = content.captains[id]!;
  const c = captain(state, content, id);
  if (c.rel < ALLY.steadyRel && roll < ALLY.hangBack) {
    shiftRel(state, content, id, -1);
    return { men: 0, line: `${def.name}'s ships hang back, oars out, watching. Whatever he swore, he isn't coming in.` };
  }
  return { men: def.men, line: `${def.name}'s men come in on your flank with a roar: ${def.men} of them.` };
}

/** Hold his partner's ships add to the fleet's. */
export function partnerHold(state: GameState, content: ContentBundle): number {
  const id = partner(state, content);
  return id ? content.captains[id]!.ships * ALLY.holdPerShip : 0;
}

/** At the dividing: the partner takes his men's part of the pot (more, if he's greedy and no friend). */
export function partnerCut(state: GameState, content: ContentBundle, pot: number, ours: number): { cut: number; line: string | null } {
  const id = partner(state, content);
  if (!id || pot <= 0) return { cut: 0, line: null };
  const def = content.captains[id]!;
  const c = captain(state, content, id);
  let cut = Math.round((pot * def.men) / (def.men + Math.max(1, ours)));
  let line = `${def.name} takes his men's part of the heap: ${formatSilver(cut)}.`;
  if (def.temperament === 'greedy' && c.rel < ALLY.honestRel) {
    const extra = Math.min(pot - cut, Math.round(cut * ALLY.greedyExtra));
    cut += extra;
    shiftRel(state, content, id, -2);
    line = `${def.name} takes his men's part of the heap, and then some: ${formatSilver(cut)}, weighed on his own scales. Your men watch him do it.`;
  }
  state.partner!.loot += pot;
  return { cut, line };
}

/** The summer is over: the félag ends, and what it was worth is remembered. */
export function endFelag(state: GameState, content: ContentBundle): string | null {
  const p = state.partner;
  if (!p) return null;
  delete state.partner;
  if (!captain(state, content, p.id).alive) return null;
  const name = content.captains[p.id]!.name;
  if (p.loot > 0) {
    shiftRel(state, content, p.id, 1);
    return `The félag with ${name} ends with the summer, and you part friends.`;
  }
  shiftRel(state, content, p.id, -1);
  return `The félag with ${name} ends with the summer, and nothing to show for it. He doesn't say it was your fault.`;
}

// ---- the jarl ----

export function favour(state: GameState): number {
  return state.favour ?? 0;
}

export function shiftFavour(state: GameState, n: number): void {
  state.favour = Math.max(FAVOUR.min, Math.min(FAVOUR.max, favour(state) + n));
}

export function favourWord(f: number): string {
  return f >= 7 ? 'one of his own' : f >= 4 ? 'in high favour' : f >= 1 ? 'well thought of' : f >= -2 ? 'one captain among many' : f >= -5 ? 'out of favour' : 'in disgrace';
}

/** The jarl's cut for the loan of a ship. */
export function jarlCut(state: GameState, base: number): number {
  return favour(state) >= FAVOUR.goodAt ? FAVOUR.cutGood : base;
}

/** Men the jarl's favour sends to the muster, or keeps from it. */
export function favourMuster(state: GameState): number {
  const f = favour(state);
  return f > 0 ? Math.floor(f / 2) : f <= FAVOUR.badAt ? -3 : 0;
}
