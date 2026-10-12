// Ships, crew and the sworn men: capacity, mouths to feed, morale, loyalty.
import type { ContentBundle } from '../content/schema';
import type { GameState, SwornMan } from './state';

export const SHIP_NAMES = ['Grey Goose', 'Wave-Stallion', 'Oak-Heart', 'Storm-Wolf', 'Sea-Raven', 'Gull', 'Black Hart', 'Spray-Horse', 'Iron Beak', 'Long Otter'];

export function aliveMen(state: GameState): SwornMan[] {
  return state.men.filter((m) => m.alive);
}

/** Men fit to stand in a fight today. */
export function fitMen(state: GameState): SwornMan[] {
  return state.men.filter((m) => m.alive && (m.hurtUntil === null || m.hurtUntil <= state.day));
}

/** Everyone who eats: the crew, the sworn men and the hero. */
export function mouths(state: GameState): number {
  return state.crew.men + aliveMen(state).length + 1;
}

/** Men the fleet can carry. */
export function capacity(state: GameState, content: ContentBundle): number {
  return state.ships.reduce((s, sh) => s + (content.ships[sh.type]?.crew ?? 0), 0);
}

export function fleetSpeed(state: GameState, content: ContentBundle): number {
  if (!state.ships.length) return 0.5;
  const slowest = Math.min(...state.ships.map((s) => content.ships[s.type]?.speed ?? 1));
  const oars = state.ships.reduce((s, sh) => s + (content.ships[sh.type]?.oars ?? 0), 0);
  const rowers = state.crew.men + aliveMen(state).length;
  return slowest * (rowers < oars * 0.5 ? 0.8 : 1);
}

export function clampMorale(state: GameState): void {
  state.crew.morale = Math.max(0, Math.min(10, Math.round(state.crew.morale * 10) / 10));
}

export function addLoyalty(m: SwornMan, n: number): void {
  m.loyalty = Math.max(0, Math.min(10, m.loyalty + n));
}

export function newMan(content: ContentBundle, id: string): SwornMan {
  const d = content.men[id];
  if (!d) throw new Error(`unknown sworn man ${id}`);
  return {
    id,
    name: d.name,
    temperament: d.temperament,
    weapons: d.weapons,
    loyalty: d.loyalty,
    alive: true,
    slot: d.temperament === 'hot' ? 'front' : 'wall',
    deeds: 0,
    nickname: null,
    diedOn: null,
    sworn: true,
    hurtUntil: null,
  };
}

/** Newly signed men dilute the crew's quality toward green. */
export function addRecruits(state: GameState, n: number): void {
  const total = state.crew.men + n;
  if (total <= 0) return;
  state.crew.quality = (state.crew.quality * state.crew.men) / total;
  state.crew.men = total;
}
