// Land abroad (docs/FRAME-WORLD.md §D): a holding is a place he can winter as at home, call out men from in
// the spring, and draw a yield from at the turn of the year. Granted by a lord, bought in a Norse place, or taken
// by the sword: a ship-fort on a hostile coast, which its people try to take back every year.
import type { ContentBundle } from '../content/schema';
import type { GameState, Ship } from './state';
import type { RngCursor } from './rng';
import { dateOf } from './calendar';
import { journal } from './journal';
import { formatSilver, plural } from './format';
import { livingFame } from './fame';
import { tierAt } from './standing';
import { addRecruits, capacity, aliveMen, mouths } from './crew';
import { freeShipName, hold } from './fleet';
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
  /** A ship and her master left to hold a ship-fort for him (Josh, 2026-11-09). */
  warden?: { ship: Ship; years: number };
}

/** A warden in a ship-fort (Josh, 2026-11-09: "leave a ship and her ship master at a ship fort so he automatically
 *  governs it. Adding men every spring, taking a portion of the income to ensure it is protected and grows"). */
export const WARDEN = {
  /** Men who come to a warded fort every spring: off the ships that put in, younger sons who hear there is a hall. */
  recruits: 6,
  /** The most a warded fort keeps; and what he keeps back when his lord calls men out of it. */
  cap: 90,
  keep: 30,
  /** The yield grows by this every year he holds it, up to growMax. */
  grow: 8,
  growMax: 40,
  /** His share of what the fort brings in: it pays for the men and the walls. */
  share: 1 / 3,
  /** A warden keeps the ditch and the stockade in repair: the walls count this much, not LAND.walls. */
  walls: 3,
  winterLoss: 1,
  /** A sworn warden of this loyalty or less may keep the fort for himself: the chance a year. A hired one: hiredTurn. */
  turnLoyalty: 3,
  turnChance: 0.3,
  hiredTurn: 0.05,
} as const;

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
  return LAND[h.kind].yield + (h.warden ? Math.min(WARDEN.growMax, WARDEN.grow * h.warden.years) : 0);
}

function wardenOf(state: GameState, h: Holding): { name: string; id?: string } | null {
  const m = h.warden?.ship.master;
  if (!m) return null;
  const [kind, rest] = m.split(':') as [string, string];
  if (kind === 'man') { const x = state.men.find((y) => y.id === rest); return x ? { name: x.name, id: x.id } : null; }
  return { name: rest };
}

/** Who holds the fort for him, for the UI and the scenes. */
export function wardenLabel(state: GameState, h: Holding): string | null {
  return h.warden ? `${wardenOf(state, h)?.name ?? 'Her master'}, with ${h.warden.ship.name}` : null;
}

/** Ships he could leave at this fort: not the flagship, and with a man at her steering-oar. */
export function wardShips(state: GameState, place: string): Ship[] {
  const h = holdingAt(state, place);
  if (!h || h.kind !== 'fort' || h.warden || state.service) return [];
  return state.ships.slice(1).filter((s) => !!s.master);
}

/** Men of her crew who stay with her: her benches, as far as the crew goes, leaving six at the oars of the rest. */
export function wardMen(state: GameState, content: ContentBundle, ship: Ship): number {
  return Math.max(0, Math.min(content.ships[ship.type]?.crew ?? 20, state.crew.men - 6));
}

export function wardFort(state: GameState, content: ContentBundle, place: string, shipId: string): string[] {
  const h = holdingAt(state, place)!;
  const ship = state.ships.find((s) => s.id === shipId)!;
  const n = wardMen(state, content, ship);
  state.ships = state.ships.filter((s) => s !== ship);
  state.crew.men -= n;
  h.garrison = (h.garrison ?? 0) + n;
  h.warden = { ship, years: 0 };
  const w = wardenOf(state, h)!;
  if (w.id) state.men.find((m) => m.id === w.id)!.warden = place;
  state.loot = Math.min(state.loot, hold(state, content));
  const name = content.places[place]!.name;
  journal(state, `Left ${ship.name} and ${w.name} to hold the fort at ${name}.`);
  return [
    `${ship.name} is drawn up inside the ditch at ${name}, and her crew carry their sea-chests up to the hall. ${w.name} takes the high seat when you are gone, and the keys, and the say over the gate.`,
    `${plural(h.garrison, 'man', 'men')} hold it now. He will take in men every spring, keep the ditch and the stockade in repair, and keep back a third of what the fort brings in, to pay for it.`,
  ];
}

export function unwardFort(state: GameState, content: ContentBundle, place: string): string[] {
  const h = holdingAt(state, place)!;
  const ship = h.warden!.ship;
  const w = wardenOf(state, h);
  const want = content.ships[ship.type]?.crew ?? 20;
  const n = Math.max(0, Math.min(want, (h.garrison ?? 0) - LAND.garrisonMin));
  h.garrison = (h.garrison ?? 0) - n;
  state.crew.men += n;
  if (w?.id) delete state.men.find((m) => m.id === w.id)!.warden;
  delete h.warden;
  ship.name = freeShipName(state, ship.name);
  state.ships.push(ship);
  const name = content.places[place]!.name;
  journal(state, `Took ${ship.name} and ${w?.name ?? 'her master'} back from the fort at ${name}.`);
  return [`${w?.name ?? 'Her master'} gives you back the keys of the fort at ${name}. ${ship.name} goes back into the water with ${plural(n, 'man', 'men')} of the garrison at her oars. ${plural(h.garrison ?? 0, 'man', 'men')} stay to hold it.`];
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
  // a warden with more men than the fort needs sends the rest down to the ships
  const spare = h.warden ? Math.max(0, Math.min(room - n, (h.garrison ?? 0) - WARDEN.keep)) : 0;
  if (spare) { h.garrison = (h.garrison ?? 0) - spare; addRecruits(state, spare); }
  state.provisions += (n + spare + mouths(state)) * LAND.food / 2;
  state.day += 2;
  if (h.warden) {
    const w = wardenOf(state, h)?.name ?? 'Your warden';
    return [`${w} comes down to the shore to meet you. ${spare ? `He can spare ${plural(spare, 'man', 'men')} from the fort, and sends them down with their sea-chests; ` : 'He has no men to spare: the fort needs all it has; '}${plural(h.garrison ?? 0, 'man', 'men')} stay to hold it. There is meal and dried fish for the ships.`];
  }
  return [n
    ? `${plural(n, 'man', 'men')} from your land at ${content.places[place]!.name} come down to the shore with their sea-chests and a sack of meal each, because you are their lord and it is spring.`
    : `Your people at ${content.places[place]!.name} bring meal and dried fish down to the ships. There are no benches free for their sons.`];
}

/** The chance a year that a fort's people take it back, if he does not winter in it. */
export function fortRisk(state: GameState, content: ContentBundle, h: Holding): number {
  const D = content.places[h.place]!.raid?.defenders ?? 20;
  return LAND.retake * D / (D + (h.warden ? WARDEN.walls : LAND.walls) * (h.garrison ?? 0) + LAND.walls * networkSupport(state, h));
}

/** A sea-jarl's forts stand together (seajarl.ts): a fort's people count this share of the other forts' garrisons. */
export const FORT_SUPPORT = 0.25;

/** A fort's help from the rest of a sea-jarl's network: the share of the other forts' garrisons that would come. */
export function networkSupport(state: GameState, h: Holding): number {
  if (!state.seajarl || h.kind !== 'fort') return 0;
  const others = (state.holdings ?? []).filter((x) => x !== h && x.kind === 'fort').reduce((n, x) => n + (x.garrison ?? 0), 0);
  return Math.round(others * FORT_SUPPORT);
}

/** The turn of the year: what the holdings bring in; and the forts, which their people come back for. */
export function holdingsYear(state: GameState, content: ContentBundle, rng: RngCursor, wintered: string | null): string[] {
  const lines: string[] = [];
  for (const h of [...(state.holdings ?? [])]) {
    const name = content.places[h.place]!.name;
    if (h.kind === 'fort') {
      const G = h.garrison ?? 0;
      const p = fortRisk(state, content, h);
      // a warden who has stopped loving his lord keeps the fort for himself
      if (h.warden && wintered !== h.place) {
        const w = wardenOf(state, h);
        const m = w?.id ? state.men.find((x) => x.id === w.id) : undefined;
        const turn = m ? (m.loyalty <= WARDEN.turnLoyalty ? WARDEN.turnChance : 0) : WARDEN.hiredTurn;
        if (rng.float() < turn) {
          state.holdings = state.holdings!.filter((x) => x !== h);
          if (m) { state.men = state.men.filter((x) => x !== m); (state.usedNames ??= []).push(m.name); }
          if (state.homeAt === h.place) delete state.homeAt;
          lines.push(`Word comes over the winter from ${name}: ${w?.name ?? 'your warden'} has taken the high seat there for his own. The men in the fort are his men now, and ${h.warden.ship.name} is his ship. He sends no silver, and no excuses.`);
          journal(state, `${w?.name ?? 'The warden'} kept the fort at ${name} for himself.`);
          continue;
        }
      }
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
        if (h.warden) {
          const w = wardenOf(state, h);
          const m = w?.id ? state.men.find((x) => x.id === w.id) : undefined;
          if (m) { m.alive = false; m.diedOn = state.day; delete m.warden; }
          lines.push(`${w?.name ?? 'Your warden'} died at the gate with his sword in his hand, the one man there they could not sell. ${h.warden.ship.name} was burned on the shore.`);
          journal(state, `${w?.name ?? 'The warden'} died holding the fort at ${name}; ${h.warden.ship.name} was burned.`);
        }
        continue;
      }
      h.garrison = Math.max(0, G - (h.warden ? WARDEN.winterLoss : LAND.winterLoss));
      if (h.warden) {
        const come = Math.max(0, Math.min(WARDEN.recruits, WARDEN.cap - h.garrison));
        h.garrison += come;
        h.warden.years += 1;
        const w = wardenOf(state, h)?.name ?? 'Your warden';
        lines.push(`The fort at ${name} held through the winter under ${w}.${come ? ` ${plural(come, 'man', 'men')} came to it over the year, off the ships that put in and from the farms, because there is a hall there now and a lord's man in it.` : ''} ${plural(h.garrison, 'man', 'men')} hold it.`);
        const y = holdingYield(h);
        const his = Math.round(y * WARDEN.share);
        if (y) {
          state.silver += y - his;
          earn(state, y - his);
          lines.push(`The fort at ${name} brought in ${formatSilver(y)}: ${w} kept ${formatSilver(his)} for the men and the walls, and sent you ${formatSilver(y - his)}.`);
        }
        continue;
      }
      lines.push(wintered === h.place ? `The fort at ${name} held through the winter with you in it. Nobody came over the ditch.` : `The fort at ${name} held through the winter. ${plural(LAND.winterLoss, 'man', 'men')} of its garrison died of the cold and the flux and the Irish.`.replace('the Irish', content.places[h.place]!.people === 'gael' ? 'the Irish' : 'the neighbours'));
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
