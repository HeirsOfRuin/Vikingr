// The hird grows (docs/FRAME-HIRD-HOSTAGES.md). Past the four bench-mates, new sworn men are made from an
// origin when a recruiting scene opens: an oarsman of his own, a sword for hire in a port, a beaten enemy,
// kin, a freed thrall. Each swears on a ring; the base sets how many he can keep at his table.
import type { ContentBundle } from '../content/schema';
import type { GameState, SwornMan } from './state';
import { RngCursor, seedRng } from './rng';
import { aliveMen, addRecruits } from './crew';
import { addRings, ringsOf, RING, type Metal } from './rings';
import { addLoyalty } from './crew';
import { addDeed } from './fame';
import { give } from './hardship';
import { journal } from './journal';

export const HIRD = {
  /** Sworn men he can keep at his table, by base. */
  cap: { father: 4, farm: 8, hall: 15 } as Record<string, number>,
  /** A new man at or below this loyalty walks at the year's turn. */
  leaveAt: 1,
};

export function hirdCount(state: GameState): number {
  return aliveMen(state).filter((m) => m.sworn).length;
}

export function hirdRoom(state: GameState): number {
  return Math.max(0, (HIRD.cap[state.base.level] ?? 4) - hirdCount(state));
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The man a recruiting scene offers: the same man for the same day, so a reload does not reroll him. */
export function makeCandidate(state: GameState, content: ContentBundle, origin: string): SwornMan {
  const o = content.recruits[origin];
  if (!o) throw new Error(`unknown recruit origin ${origin}`);
  const rng = new RngCursor(seedRng((state.seed ^ hash(`${origin}:${state.day}:${state.men.length}`)) >>> 0));
  const taken = new Set([...state.men.map((m) => m.name), ...Object.values(state.standIns ?? {}), state.hero.name.split(' ')[0], ...state.ships.map((s) => s.master?.split(':')[1] ?? ''), ...npcNames(content), ...(state.usedNames ?? [])]);
  const pool = (o.names === 'norse' ? content.names : o.names).filter((n) => !taken.has(n));
  // the man who took a fallen sworn man's bench already has a name in the scenes: he keeps it
  const heir = origin === 'heir' ? state.men.filter((m) => !m.alive && m.sworn && state.standIns?.[m.id]).sort((a, b) => (b.diedOn ?? 0) - (a.diedOn ?? 0)).map((m) => state.standIns![m.id]!).find((n) => !state.men.some((x) => x.name === n)) : undefined;
  const name = heir ?? (pool.length ? pool[rng.int(pool.length)]! : 'Grim');
  const between = ([a, b]: [number, number]) => a + rng.int(b - a + 1);
  const temperament = o.temperaments[rng.int(o.temperaments.length)]!;
  const n = state.men.filter((m) => m.origin).length;
  return {
    id: `g${n + 1}_${hash(name + state.day).toString(36).slice(0, 4)}`,
    name,
    temperament,
    weapons: between(o.weapons),
    loyalty: between(o.loyalty),
    alive: true,
    slot: temperament === 'hot' ? 'front' : 'wall',
    deeds: 0,
    nickname: null,
    diedOn: null,
    sworn: false,
    hurtUntil: null,
    origin,
    desc: o.descs[rng.int(o.descs.length)]!.replace(/\{he\}/g, name),
  };
}

/** The candidate swears on a ring from the chest. No ring, no oath. */
export function swearCandidate(state: GameState, content: ContentBundle, metal: Metal): void {
  const m = state.cand;
  if (!m) return;
  if (ringsOf(state)[metal] <= 0) return;
  addRings(state, metal, -1);
  m.sworn = true;
  addLoyalty(m, RING[metal].loyalty - 2);
  state.men.push(m);
  state.cand = null;
  give(state, 'ring');
  addDeed(state, content, { type: 'ring_giving', text: `Took the oath of ${m.name}, and gave him ${metal === 'gold' ? 'gold' : 'a ring'}`, witnesses: state.crew.men, mult: RING[metal].deed });
  journal(state, `${m.name} gave you his oath, on ${metal === 'gold' ? 'a gold' : 'a silver'} ring.`);
}

/** He signs on at an oar instead: one more man on the benches, no oath. */
export function candidateToCrew(state: GameState): void {
  if (!state.cand) return;
  addRecruits(state, 1);
  journal(state, `${state.cand.name} took an oar.`);
  state.cand = null;
}

/** The year's turn: a new man whose loyalty has run out takes his things and goes. */
export function hirdLeaves(state: GameState): string[] {
  const lines: string[] = [];
  for (const m of aliveMen(state)) {
    if (!m.origin || !m.sworn || m.loyalty > HIRD.leaveAt) continue;
    if (state.ships.some((s) => s.master === `man:${m.id}`)) continue; // a master who walks takes the ship: fleet.ts deals with him
    state.men = state.men.filter((x) => x !== m); (state.usedNames ??= []).push(m.name);
    journal(state, `${m.name} went off to find a better lord.`);
    lines.push(`${m.name} comes to you at the turn of the year and gives you back his oath, which is more than most would do. He has found a lord who gives more, or says he has. He is gone by the morning.`);
  }
  return lines;
}

/** The first names of the world's lords, captains and fighters: a new crewman is not another Harek (npm run continuity). */
function npcNames(content: ContentBundle): string[] {
  const first = (n: string) => n.split(/[ ,]/)[0]!;
  return [...Object.values(content.captains).map((c) => first(c.name)), ...Object.values(content.lords).map((l) => first(l.name)), ...Object.values(content.fighters).map((f) => first(f.name)), ...Object.values(content.men).map((m) => m.name)];
}
