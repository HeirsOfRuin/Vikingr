// Land abroad (docs/FRAME-WORLD.md §D): a holding is a place he can winter as at home, call out men from in
// the spring, and draw a yield from at the turn of the year. Granted by a lord, bought in a Norse place, or taken
// by the sword: a ship-fort on a hostile coast, which its people try to take back every year.
import type { ContentBundle } from '../content/schema';
import type { GameState } from './state';
import type { RngCursor } from './rng';
import { dateOf } from './calendar';
import { journal } from './journal';
import { formatSilver, plural } from './format';
import { livingFame } from './fame';
import { tierAt } from './standing';
import { addRecruits, capacity, aliveMen, mouths } from './crew';
import { earn } from './hardship';
import { addDeed } from './fame';
import { lordName } from './lords';
import { loseHome } from './settle';

export type HoldingKind = 'grant' | 'bought' | 'fort' | 'claimed';
export interface Holding {
  place: string;
  kind: HoldingKind;
  /** The lord it is held from (a grant). */
  lord?: string;
  since: number;
  /** Men left to hold a ship-fort. */
  garrison?: number;
  /** The year its men were last called out. */
  mustered?: number;
}

export const LAND = {
  grant: { yield: 24, men: 4 },
  bought: { yield: 18, men: 2 },
  fort: { yield: 40, men: 3 },
  /** Land taken in an empty country (docs/FRAME-LINEAGE.md E): poor at first, nobody's but his. */
  claimed: { yield: 12, men: 2 },
  price: 288,
  /** To dig a fort: men with him, a name, and the garrison he leaves (at least this, or a third of his men). */
  fortMen: 40,
  fortFame: 40,
  garrisonMin: 15,
  /** A fort's people come back for it: the chance a year, against its garrison (and a fort's walls count double). */
  retake: 0.6,
  walls: 2,
  /** Food the landsmen bring with them, a man. */
  food: 20,
  /** A fort's garrison loses men every winter it holds. */
  winterLoss: 3,
} as const;

/** Norse places where land can be bought (and any place a Norse ship-fort holds). */
export const BUYABLE = ['shetland', 'orkney', 'faroes', 'skye'];

export function holdingAt(state: GameState, place: string | null): Holding | undefined {
  return place ? (state.holdings ?? []).find((h) => h.place === place) : undefined;
}

export function holdingYield(h: Holding): number {
  if (h.kind === 'fort' && (h.garrison ?? 0) < 10) return 0;
  return LAND[h.kind].yield;
}

/** Why he can't buy land here, or null. */
export function buyBlock(state: GameState, content: ContentBundle, place: string): string | null {
  if (holdingAt(state, place)) return 'You hold land here already.';
  const t = tierAt(state, content, place);
  if (t !== 'friendly' && t !== 'allied') return 'They would not sell land to a man they do not trust.';
  if (state.silver < LAND.price) return `You need ${formatSilver(LAND.price)}.`;
  return null;
}

export function canBuyHere(state: GameState, place: string): boolean {
  return BUYABLE.includes(place) || (!!state.places[place]?.norse && !(state.holdings ?? []).some((h) => h.place === place));
}

export function buyLand(state: GameState, content: ContentBundle, place: string): string[] {
  state.silver -= LAND.price;
  (state.holdings ??= []).push({ place, kind: 'bought', since: state.day });
  journal(state, `Bought land at ${content.places[place]!.name}.`);
  return [`You buy a farm at ${content.places[place]!.name} from a man going home to Norway: a longhouse, a byre, a boat-shed and a strip of shore. ${formatSilver(LAND.price)}. The neighbours come to look at you. One of them brings ale.`];
}

/** A lord's grant (scenes call this). */
export function grantLand(state: GameState, content: ContentBundle, lord: string): string | null {
  const place = content.lords[lord]?.grant;
  if (!place || holdingAt(state, place)) return null;
  (state.holdings ??= []).push({ place, kind: 'grant', lord, since: state.day });
  journal(state, `Was given land at ${content.places[place]!.name} by ${lordName(state, content, lord)}.`);
  addDeed(state, content, { type: 'deed', text: `Was given land at ${content.places[place]!.name} by ${lordName(state, content, lord)}`, weight: 4, witnesses: 100 });
  return place;
}

/** A landnám (docs/FRAME-LINEAGE.md E): land nobody holds, in a country being settled. Why not, or null. */
export function claimBlock(state: GameState, content: ContentBundle, place: string): string | null {
  const from = content.places[place]?.landnam;
  if (from === undefined) return 'There is no land to take here.';
  if (dateOf(state.day).year < from) return `Nobody has settled here yet; men say it will be taken from ${from} or so.`;
  if (holdingAt(state, place)) return 'You hold land here already.';
  if (state.service) return 'Not while you row in another man\'s ship.';
  return null;
}

export function claimLand(state: GameState, content: ContentBundle, place: string): void {
  (state.holdings ??= []).push({ place, kind: 'claimed', since: state.day });
  journal(state, `Took land at ${content.places[place]!.name}.`);
  addDeed(state, content, { type: 'deed', text: `Took land in ${content.places[place]!.region}, at ${content.places[place]!.name}`, weight: 6, witnesses: state.crew.men });
}

/** Why he can't dig a ship-fort here, or null. */
export function fortBlock(state: GameState, content: ContentBundle, place: string): string | null {
  const ps = state.places[place];
  if (!ps || ps.norse) return 'A Norse ship-fort holds it already.';
  if (ps.wonOn === undefined || dateOf(ps.wonOn).year !== dateOf(state.day).year) return 'You would have to take it first.';
  if (state.crew.men < LAND.fortMen) return `You need ${LAND.fortMen} men: some to dig, some to stay.`;
  if (livingFame(state) < LAND.fortFame) return 'Nobody would stay behind in a ditch for a man without a name.';
  return null;
}

export function garrisonFor(state: GameState): number {
  return Math.max(LAND.garrisonMin, Math.floor(state.crew.men / 3));
}

export function digFort(state: GameState, content: ContentBundle, place: string): string[] {
  const g = garrisonFor(state);
  state.crew.men -= g;
  const ps = state.places[place]!;
  ps.norse = true;
  ps.standing = Math.max(ps.standing ?? 0, 2);
  (state.holdings ??= []).push({ place, kind: 'fort', since: state.day, garrison: g });
  state.day += 10;
  journal(state, `Dug a ship-fort at ${content.places[place]!.name}, and left ${plural(g, 'man', 'men')} to hold it.`);
  addDeed(state, content, { type: 'deed', text: `Dug a ship-fort at ${content.places[place]!.name}, and held it`, weight: 5, witnesses: state.crew.men + g });
  return [`Ten days of digging: a ditch from the water round to the water, the earth thrown up inside, a stockade of split timber on top, and the ships drawn up behind it. ${plural(g, 'man', 'men')} will stay to hold it through the winter, with the slaves and the cattle and the market that will come to the gate as soon as the people round about see you are staying.`, 'They will come back for it. Every year, they will come back for it.'];
}

/** Spring at a holding: its men come down to the shore, with their food. */
export function canMuster(state: GameState, place: string): Holding | null {
  const h = holdingAt(state, place);
  if (!h || h.mustered === dateOf(state.day).year) return null;
  return dateOf(state.day).month <= 5 ? h : null;
}

export function musterHolding(state: GameState, content: ContentBundle, place: string): string[] {
  const h = holdingAt(state, place)!;
  h.mustered = dateOf(state.day).year;
  const room = Math.max(0, capacity(state, content) - state.crew.men - aliveMen(state).length);
  const n = Math.min(room, LAND[h.kind].men);
  addRecruits(state, n);
  state.provisions += (n + mouths(state)) * LAND.food / 2;
  state.day += 2;
  return [n
    ? `${plural(n, 'man', 'men')} from your land at ${content.places[place]!.name} come down to the shore with their sea-chests and a sack of meal each, because you are their lord and it is spring.`
    : `Your people at ${content.places[place]!.name} bring meal and dried fish down to the ships. There are no benches free for their sons.`];
}

/** The turn of the year: what the holdings bring in; and the forts, which their people come back for. */
export function holdingsYear(state: GameState, content: ContentBundle, rng: RngCursor, wintered: string | null): string[] {
  const lines: string[] = [];
  for (const h of [...(state.holdings ?? [])]) {
    const name = content.places[h.place]!.name;
    if (h.kind === 'fort') {
      const D = content.places[h.place]!.raid?.defenders ?? 20;
      const G = h.garrison ?? 0;
      const p = LAND.retake * D / (D + LAND.walls * G);
      // home, and he wintered in it: they come, and he is there to fight for it (docs/FRAME-LINEAGE.md C)
      if (wintered === h.place && state.homeAt === h.place) {
        if (rng.float() < p) state.queue.push({ scene: 'st_fort_attack', day: state.day });
      } else if (wintered !== h.place && rng.float() < p) {
        if (state.homeAt === h.place) { lines.push(...loseHome(state, content)); continue; }
        state.holdings = state.holdings!.filter((x) => x !== h);
        state.places[h.place]!.norse = false;
        state.places[h.place]!.standing = Math.min(state.places[h.place]!.standing ?? 0, -6);
        lines.push(`They came back for the fort at ${name} in the dark of the winter, as you knew they would: over the ditch on bundles of brushwood, through the stockade with axes. Your ${plural(G, 'man', 'men')} there are dead or sold. The fort is a black ring in the grass.`);
        journal(state, `Lost the ship-fort at ${name}.`);
        continue;
      }
      h.garrison = Math.max(0, G - LAND.winterLoss);
      lines.push(wintered === h.place ? `The fort at ${name} held through the winter with you in it. Nobody came over the ditch.` : `The fort at ${name} held through the winter. ${plural(LAND.winterLoss, 'man')} of its garrison died of the cold and the flux and the Irish.`.replace('the Irish', content.places[h.place]!.people === 'gael' ? 'the Irish' : 'the neighbours'));
    }
    const y = holdingYield(h);
    if (y) {
      state.silver += y;
      earn(state, y);
      lines.push(`Your land at ${name} brought in ${formatSilver(y)}.`);
    }
  }
  return lines;
}
