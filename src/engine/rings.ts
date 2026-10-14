// Arm-rings (the author, 2026-10-14): rings are things, not prices. A lord gives only the rings he holds, and he
// holds only the rings a smith made him, a lord gave him, or his men tore off a church's treasures. A ring is also
// silver (or gold) by weight: cut up, it pays like any hacksilver.
import type { ContentBundle } from '../content/schema';
import type { GameState, SwornMan } from './state';
import type { RngCursor } from './rng';
import { addDeed } from './fame';
import { addLoyalty } from './crew';
import { formatSilver } from './format';
import { journal } from './journal';
import { give } from './hardship';

export type Metal = 'silver' | 'gold';
export const METALS: Metal[] = ['silver', 'gold'];

export const RING = {
  /** weight: what it is worth cut up, in ørtugar. make: the weight and the smith's fee. */
  silver: { weight: 24, make: 30, loyalty: 3, deed: 1 },
  gold: { weight: 96, make: null, loyalty: 5, deed: 2.5 },
  /** On each grab of a plunder round in his own raid: a chance of a ring among the treasure. Gold only in rich places. */
  plunder: { silver: 0.12, gold: 0.03, goldWealth: 1500 },
} as const;

export function ringsOf(state: GameState): Record<Metal, number> {
  return (state.rings ??= { silver: 0, gold: 0 });
}

export function ringWords(state: GameState): string {
  const r = ringsOf(state);
  const parts = METALS.filter((m) => r[m] > 0).map((m) => `${r[m]} of ${m}`);
  return parts.length ? parts.join(', ') : 'none';
}

export function addRings(state: GameState, metal: Metal, n = 1): void {
  const r = ringsOf(state);
  r[metal] = Math.max(0, r[metal] + n);
}

/** The smith hammers one out of his own silver. */
export function makeRing(state: GameState): string {
  const cost = RING.silver.make;
  state.silver -= cost;
  addRings(state, 'silver');
  journal(state, 'Had the smith make a silver arm-ring.');
  return `The smith twists three rods of your silver into a rope, and the rope into a ring, and stamps the ends with a beast's head. ${formatSilver(cost)}, his fee included.`;
}

/** A ring cut up for hacksilver: it buys what its weight buys, and nothing more. */
export function cutRing(state: GameState, metal: Metal): string {
  if (ringsOf(state)[metal] <= 0) return 'You have no such ring.';
  addRings(state, metal, -1);
  const w = RING[metal].weight;
  state.silver += w;
  journal(state, `Cut up a ${metal} arm-ring for ${formatSilver(w)}.`);
  return metal === 'gold'
    ? `You lay the gold ring on the block and take the axe to it. ${formatSilver(w)} of silver, by weight, at the market rate, and something gone that won't come back.`
    : `You cut the ring into hacksilver on the block, a finger's width at a time. ${formatSilver(w)}.`;
}

/** Given in front of the hall: the oldest bond there is. */
export function giveRing(state: GameState, content: ContentBundle, m: SwornMan, metal: Metal): string {
  if (ringsOf(state)[metal] <= 0) throw new Error(`no ${metal} ring to give`);
  addRings(state, metal, -1);
  addLoyalty(m, RING[metal].loyalty);
  give(state, 'ring');
  addDeed(state, content, { type: 'ring_giving', text: `Gave ${metal === 'gold' ? 'a gold' : 'an'} arm-ring to ${m.name}`, witnesses: state.crew.men, mult: RING[metal].deed });
  return metal === 'gold'
    ? `You take the gold ring off your own arm and put it on ${m.name}'s, in front of the hall. The hall goes quiet. Men have rowed twenty summers and never been given gold.`
    : `You take an arm-ring from your own arm and put it on ${m.name}'s, in front of the hall.`;
}

/** A ring among the treasure: his, as the leader's pick of the heap. Only in his own raids. */
export function plunderRing(state: GameState, rng: RngCursor, wealth: number): string | null {
  if (state.service) return null;
  const r = rng.float();
  const metal: Metal | null = wealth >= RING.plunder.goldWealth && r < RING.plunder.gold ? 'gold' : r < RING.plunder.silver ? 'silver' : null;
  if (!metal) return null;
  addRings(state, metal);
  journal(state, `Took a ${metal} arm-ring in the plunder.`);
  return metal === 'gold'
    ? 'Among it, wrapped in an altar cloth, a ring of twisted gold as thick as your thumb. Nobody argues when you put it on your own arm.'
    : 'Among it, a silver arm-ring, a heavy one, still warm from whoever was wearing it. You put it on your own arm.';
}
