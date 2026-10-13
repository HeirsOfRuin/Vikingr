// The fleet (docs/FRAME-FLEET.md): every ship but the flagship needs a man at her steering-oar; the holds
// cap what a raid can carry home; storms scatter ships; prizes and secondhand hulls join the fleet.
import type { ContentBundle } from '../content/schema';
import type { GameState, Ship } from './state';
import type { RngCursor } from './rng';
import { journal } from './journal';
import { formatSilver, plural } from './format';
import { addLoyalty, aliveMen } from './crew';
import { benchHeir } from './fights';

/** Plunder a ship carries per point of `cargo` in ships.yaml, in ørtugar. */
export const CARGO_UNIT = 500;
export const FLEET_MAX = 5;
/** Extra shares a shipmaster takes at the share-out. */
export const MASTER_SHARES = { sworn: 2, hired: 3 } as const;
/** A secondhand hull at a market, as a share of the new price; she comes in at this soundness. */
export const SECONDHAND = 0.7;
export const SECONDHAND_HULL = 70;
export const SECONDHAND_TYPES = ['karvi', 'knarr', 'snekkja'] as const;
/** Men who come to the muster for each ship beyond the first. */
export const MUSTER_PER_SHIP = 3;
export const SCATTER = { chance: 0.35, founder: 0.15 } as const;
export const PRIZE_HULL = 55;

export type Master = { kind: 'sworn'; id: string; name: string } | { kind: 'hired'; name: string };

export function masterOf(state: GameState, ship: Ship): Master | null {
  if (!ship.master) return null;
  const [kind, rest] = ship.master.split(':') as [string, string];
  if (kind === 'man') {
    const m = state.men.find((x) => x.id === rest && x.alive);
    return m ? { kind: 'sworn', id: m.id, name: m.name } : null;
  }
  return { kind: 'hired', name: rest };
}

/** The ship a sworn man steers, if any. */
export function shipOf(state: GameState, manId: string): Ship | undefined {
  return state.ships.find((s) => s.master === `man:${manId}`);
}

/** The first ship (not the flagship) with a hired steersman, and the first with a sworn man at her oar. */
export function hiredShip(state: GameState): Ship | undefined {
  return state.ships.slice(1).find((s) => s.master?.startsWith('hired:'));
}
export function swornShip(state: GameState): Ship | undefined {
  return state.ships.slice(1).find((s) => s.master?.startsWith('man:') && state.men.some((m) => m.alive && `man:${m.id}` === s.master));
}

/** A hired steersman sails off with his ship, and the men aboard her. */
export function desert(state: GameState, content: ContentBundle): Ship | undefined {
  const ship = hiredShip(state);
  if (!ship) return undefined;
  const cap = content.ships[ship.type]?.crew ?? 0;
  const total = state.ships.reduce((n, s) => n + (content.ships[s.type]?.crew ?? 0), 0);
  state.crew.men = Math.max(0, state.crew.men - Math.round((state.crew.men * cap) / Math.max(1, total)));
  state.ships.splice(state.ships.indexOf(ship), 1);
  state.loot = Math.min(state.loot, hold(state, content));
  journal(state, `${ship.master!.split(':')[1]} sailed off with ${ship.name}.`);
  return ship;
}

/** What the holds will carry, in ørtugar. At another man's oar it is his problem. */
export function hold(state: GameState, content: ContentBundle): number {
  if (state.service || !state.ships.length) return Infinity;
  return state.ships.reduce((n, s) => n + (content.ships[s.type]?.cargo ?? 1) * CARGO_UNIT, 0);
}

export function holdRoom(state: GameState, content: ContentBundle): number {
  return Math.max(0, hold(state, content) - state.loot - goodsBulk(state, content));
}

/** Hold space the trade goods take (docs/FRAME-TRADE-ALLIES.md). Kept here to spare a cycle with trade.ts. */
function goodsBulk(state: GameState, content: ContentBundle): number {
  return Object.entries(state.cargo ?? {}).reduce((n, [g, c]) => n + c.lots * (content.goods[g]?.bulk ?? 0), 0);
}

/** Plunder into the holds, up to what they carry. Returns what was left behind. */
export function stow(state: GameState, content: ContentBundle, n: number): number {
  const took = Math.min(n, holdRoom(state, content));
  state.loot += took;
  return n - took;
}

function hiredName(state: GameState, content: ContentBundle): string {
  const taken = new Set([...state.men.map((m) => m.name), ...state.ships.map((s) => s.master?.split(':')[1] ?? ''), ...Object.values(state.standIns ?? {})]);
  const free = content.names.filter((n) => !taken.has(n));
  return free[(state.day * 11 + state.ships.length * 5) % Math.max(1, free.length)] ?? 'Hrolf';
}

/** A ship joins the fleet. The flagship needs no master; any other gets a hired steersman, and a scene lets him choose. */
export function addShip(state: GameState, content: ContentBundle, ship: Omit<Ship, 'id'> & { id?: string }): Ship {
  const s: Ship = { id: ship.id ?? `ship${state.day}_${state.ships.length}`, ...ship };
  state.ships.push(s);
  if (state.ships.length > 1 && !s.master) {
    s.master = `hired:${hiredName(state, content)}`;
    if (content.scenes.fl_master && !state.service) state.queue.push({ scene: 'fl_master', day: state.day });
  }
  return s;
}

/** Gives a ship's steering-oar to a sworn man, or back to a hired steersman. */
export function appoint(state: GameState, content: ContentBundle, shipId: string, who: string): void {
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship || state.ships.indexOf(ship) === 0) return;
  if (who === 'hired') {
    ship.master = `hired:${hiredName(state, content)}`;
    return;
  }
  const m = state.men.find((x) => x.id === who && x.alive && x.sworn);
  if (!m) return;
  const old = shipOf(state, who);
  if (old && old !== ship) old.master = `hired:${hiredName(state, content)}`;
  if (ship.master !== `man:${who}`) addLoyalty(m, 2);
  ship.master = `man:${who}`;
  journal(state, `${m.name} has the steering-oar of ${ship.name}.`);
}

/** Sworn men who could take a ship: alive, sworn, and not already steering one. */
export function freeSworn(state: GameState): string[] {
  return aliveMen(state).filter((m) => m.sworn && !shipOf(state, m.id)).map((m) => m.id);
}

/** Extra shares the masters take at the share-out. */
export function masterShares(state: GameState): { shares: number; sworn: string[]; hired: number } {
  let shares = 0;
  const sworn: string[] = [];
  let hired = 0;
  for (const s of state.ships.slice(1)) {
    const m = masterOf(state, s);
    if (!m) continue;
    if (m.kind === 'sworn') { shares += MASTER_SHARES.sworn; sworn.push(m.id); } else { shares += MASTER_SHARES.hired; hired++; }
  }
  return { shares, sworn, hired };
}

/** A storm with more than one ship: one of them may be lost in the dark, and come in late, or never. */
export function scatter(state: GameState, content: ContentBundle, rng: RngCursor, lines: string[]): void {
  if (state.service || state.ships.length < 2 || rng.float() >= SCATTER.chance) return;
  const i = 1 + rng.int(state.ships.length - 1);
  const ship = state.ships[i]!;
  const m = masterOf(state, ship);
  if (rng.float() < SCATTER.founder) {
    const cap = content.ships[ship.type]?.crew ?? 0;
    const total = state.ships.reduce((n, s) => n + (content.ships[s.type]?.crew ?? 0), 0);
    const aboard = Math.round((state.crew.men * cap) / Math.max(1, total));
    state.crew.men = Math.max(0, state.crew.men - aboard);
    state.loot = Math.min(state.loot, Math.max(0, hold(state, content) - (content.ships[ship.type]?.cargo ?? 1) * CARGO_UNIT));
    state.ships.splice(i, 1);
    lines.push(`In the dark you lose sight of ${ship.name}. She never comes in. Days later a fishing boat finds a spar with her paint on it.${aboard ? ` ${plural(aboard, 'man', 'men')} went down with her.` : ''}`);
    journal(state, `${ship.name} was lost in a storm, with all hands.`);
    if (m?.kind === 'sworn') {
      const man = state.men.find((x) => x.id === m.id)!;
      man.alive = false;
      man.diedOn = state.day;
      (state.standIns ??= {})[man.id] = benchHeir(state, content);
      lines.push(`${man.name} was at her steering-oar.`);
      journal(state, `${man.name} drowned with ${ship.name}.`);
      if (content.scenes[`mourn_${man.id}`]) state.queue.push({ scene: `mourn_${man.id}`, day: state.day + 1 });
    }
    return;
  }
  const late = 1 + rng.int(2);
  state.day += late;
  lines.push(`In the dark you lose sight of ${ship.name}. You wait for her ${plural(late, 'day')} in the lee of the land, and she comes in at last with her sail in rags and ${m ? m.name : 'her steersman'} grinning like a fool.`);
}

/** Secondhand hulls for sale at a market shipwright. */
export function hullsForSale(state: GameState, content: ContentBundle): { type: string; price: number }[] {
  if (state.service || state.ships.length >= FLEET_MAX) return [];
  return SECONDHAND_TYPES.map((t) => ({ type: t, price: Math.round((content.ships[t]?.cost ?? 0) * SECONDHAND) }));
}

export function buyHull(state: GameState, content: ContentBundle, type: string, name: string): string {
  const offer = hullsForSale(state, content).find((h) => h.type === type)!;
  state.silver -= offer.price;
  const s = addShip(state, content, { type, name, hull: SECONDHAND_HULL });
  journal(state, `Bought ${s.name}, a secondhand ${content.ships[type]!.name.toLowerCase()}.`);
  return `You buy her for ${formatSilver(offer.price)}: ${s.name}, a ${content.ships[type]!.name.toLowerCase()} with a few summers on her and a patch in the sail.`;
}
