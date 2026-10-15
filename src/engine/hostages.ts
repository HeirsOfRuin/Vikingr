// Hostages and political prisoners (docs/FRAME-HIRD-HOSTAGES.md). A party (a notable, and the children
// with her) taken in a raid or after a sea fight, held at home for ransom, as a surety for a people's
// good behaviour, or as leverage on a rival captain. Irish hostage custom, the ransoms of the 840s and 850s.
import type { ContentBundle, People } from '../content/schema';
import type { GameState } from './state';
import type { RngCursor } from './rng';
import { dateOf } from './calendar';
import { addDeed } from './fame';
import { formatSilver, plural } from './format';
import { journal } from './journal';
import { shiftPeople } from './standing';
import { shiftFavour, shiftRel } from './allies';

export interface Hostage {
  id: string;
  kind: string;
  /** The notable's name, and the whole party as told: "Gormlaith, a lord's wife of Dorestad, and her two children". */
  name: string;
  who: string;
  /** Heads in the party, the notable included. */
  n: number;
  people: People;
  place: string;
  kin: string;
  /** Ransom asked, in ørtugar. */
  price: number;
  taken: number;
  state: 'held' | 'surety';
  /** A rival captain's kin: whose goodwill the holding costs. */
  captain?: string;
  /** A noble family's eldest daughter: an alliance her kin may offer. */
  daughter?: string;
  /** The peace he stands surety for is broken: a hs_broken scene is due. */
  broken?: boolean;
}

export const HOSTAGE = {
  /** The plunder round that looks for someone worth a ransom: the chance he finds one, by place kind. */
  find: { monastery: 0.55, hall: 0.6, town: 0.5, market: 0.45, island: 0.4, home: 0, landmark: 0 } as Record<string, number>,
  alarm: 2,
  /** Food and a guard, a winter, a head. */
  keep: 4,
  /** A surety's people pay this part of the ransom each year he is held. */
  tribute: 1 / 8,
  /** A haggle that works gets this much more. */
  haggle: 1.5,
  /** Selling a party: a thrall's price a head, which is less than any ransom. */
  sellEach: 24, // CAPTIVE_PRICE in season.ts
  /** A fosterling held this many winters can be sent home raised in your hall. */
  fosterWinters: 3,
  /** A surety's people break faith in a year, this often. */
  breakChance: 0.1,
};

export function hostagesOf(state: GameState): Hostage[] {
  return (state.hostages ??= []);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const KIDS = ['', 'her son', 'her two children', 'her three children'];

/** Makes a party of the given kind, taken at a place. */
export function makeHostage(state: GameState, content: ContentBundle, rng: RngCursor, kind: string, placeId: string, captain?: string): Hostage {
  const k = content.hostages.kinds[kind];
  if (!k) throw new Error(`unknown hostage kind ${kind}`);
  const cap = captain ? content.captains[captain] : undefined;
  const people = (cap?.people ?? (kind === 'captain_kin' ? 'norse' : content.places[placeId]?.people) ?? 'norse') as People;
  const names = content.hostages.names[people] ?? content.hostages.names.norse!;
  const name = names[k.sex][rng.int(names[k.sex].length)]!;
  const kids = k.kids ? k.kids[0] + rng.int(k.kids[1] - k.kids[0] + 1) : 0;
  const place = content.places[placeId]?.name ?? 'the sea';
  const fill = (t: string) => t.replace(/\{name\}/g, name).replace(/\{place\}/g, place).replace(/\{people\}/g, peopleName(people)).replace(/\{kids\}/g, KIDS[Math.min(3, kids)]!);
  const price = k.price[0] + rng.int(k.price[1] - k.price[0] + 1);
  const daughter = k.sex === 'f' && kids >= 2 ? names.f.filter((x) => x !== name)[rng.int(names.f.length - 1)] : undefined;
  return {
    id: `h${hostagesOf(state).length + 1}_${hash(name + state.day).toString(36).slice(0, 4)}`,
    kind,
    name,
    who: cap ? `${name}, the son of ${cap.name}` : fill(k.who),
    n: 1 + kids,
    people,
    place: placeId,
    kin: cap ? cap.name : fill(k.kin),
    price,
    taken: state.day,
    state: 'held',
    captain,
    daughter,
  };
}

const PEOPLE_NAMES: Record<string, string> = { gael: 'Irish', english: 'English', frisian: 'Frisians', frankish: 'Franks', norse: 'Norse', danish: 'Danes', swedish: 'Swedes', baltic: 'Balts', rus: 'Rus', pict: 'Picts', briton: 'Britons' };
export function peopleName(p: string): string {
  return PEOPLE_NAMES[p] ?? p;
}

/** The kinds that can be taken at a place: by its kind. */
export function kindsAt(content: ContentBundle, placeId: string): string[] {
  const pk = content.places[placeId]?.kind;
  return Object.values(content.hostages.kinds).filter((k) => pk && k.at.includes(pk)).map((k) => k.id);
}

/** The plunder round spent looking for someone worth a ransom. Returns the party, or null. */
export function findHostage(state: GameState, content: ContentBundle, rng: RngCursor, placeId: string): Hostage | null {
  const pk = content.places[placeId]?.kind ?? 'landmark';
  const kinds = kindsAt(content, placeId);
  if (!kinds.length || rng.float() >= (HOSTAGE.find[pk] ?? 0)) return null;
  const h = makeHostage(state, content, rng, kinds[rng.int(kinds.length)]!, placeId);
  hostagesOf(state).push(h);
  return h;
}

export function winters(state: GameState, h: Hostage): number {
  return dateOf(state.day).year - dateOf(h.taken).year;
}

/** The party a hostage scene is about. */
export function pickHostage(state: GameState, content: ContentBundle, sel: string): Hostage | undefined {
  const all = hostagesOf(state);
  const held = all.filter((h) => h.state === 'held');
  switch (sel) {
    case 'newest': return all[all.length - 1];
    case 'ransom': return held[0];
    case 'surety': return all.find((h) => h.state === 'surety');
    case 'broken': return all.find((h) => h.broken);
    case 'foster': return all.find((h) => h.kind === 'fosterling' && winters(state, h) >= HOSTAGE.fosterWinters);
    case 'noble': return all.find((h) => h.daughter);
    case 'political': return all.find((h) => h.captain || h.kind === 'king_son');
    default: return all[0];
  }
}

/** Condition paths: how many parties are held, and of which sort. */
export function hostageCount(state: GameState, content: ContentBundle, sel: string): number {
  const all = hostagesOf(state);
  switch (sel) {
    case 'held': return all.filter((h) => h.state === 'held').length;
    case 'surety': return all.filter((h) => h.state === 'surety').length;
    case 'canSurety': return all.filter((h) => h.state === 'held' && content.hostages.kinds[h.kind]?.surety).length;
    case 'foster': return all.filter((h) => h.kind === 'fosterling' && winters(state, h) >= HOSTAGE.fosterWinters).length;
    case 'noble': return all.filter((h) => h.daughter).length;
    case 'political': return all.filter((h) => h.captain || h.kind === 'king_son').length;
    case 'heads': return all.reduce((n, h) => n + h.n, 0);
    default: return all.length;
  }
}

function focus(state: GameState): Hostage | undefined {
  return hostagesOf(state).find((h) => h.id === state.hfocus);
}

function drop(state: GameState, content: ContentBundle, h: Hostage): void {
  state.hostages = hostagesOf(state).filter((x) => x !== h);
  if (state.hfocus === h.id) state.hfocus = null;
  if (h.captain) shiftRel(state, content, h.captain, 2);
}

export type HostageOp = 'ransom' | 'ransom_high' | 'surety' | 'sell' | 'free' | 'dies' | 'maybe_dies' | 'escape' | 'fetters' | 'foster' | 'marry' | 'hand_over' | 'keep_one' | 'sell_party';

/** What becomes of the scene's party. */
export function hostageOp(state: GameState, content: ContentBundle, rng: RngCursor, op: HostageOp): void {
  const h = focus(state);
  if (!h) return;
  const standing = (n: number) => shiftPeople(state, content, h.people, n);
  switch (op) {
    case 'ransom':
    case 'ransom_high': {
      const paid = Math.round(h.price * (op === 'ransom_high' ? HOSTAGE.haggle : 1));
      state.silver += paid;
      drop(state, content, h);
      standing(1);
      addDeed(state, content, { type: 'deed', text: `Ransomed ${h.name} for ${formatSilver(paid)}`, weight: Math.max(1, Math.round(paid / 150)) });
      journal(state, `Ransomed ${h.name} to ${h.kin} for ${formatSilver(paid)}.`);
      break;
    }
    case 'surety':
      h.state = 'surety';
      standing(2);
      journal(state, `Holds ${h.name} as surety for the peace of the ${peopleName(h.people)}: a tribute every year.`);
      break;
    case 'fetters':
      h.state = 'held';
      h.broken = false;
      h.price = Math.round(h.price * 0.6);
      state.honour -= 1;
      standing(-2);
      journal(state, `Put ${h.name} in fetters when the peace was broken.`);
      break;
    case 'sell':
    case 'sell_party': {
      const paid = h.n * HOSTAGE.sellEach;
      state.silver += paid;
      drop(state, content, h);
      standing(-3);
      state.honour -= h.kind === 'abbot' ? 1 : 0;
      journal(state, `Sold ${h.name}${h.n > 1 ? ' and the children' : ''} to the slave-trader for ${formatSilver(paid)}.`);
      break;
    }
    case 'keep_one': {
      // the mother sold, the eldest kept: a smaller party, a smaller price
      const sold = h.n - 1;
      if (sold > 0) { state.silver += sold * HOSTAGE.sellEach; standing(-2); }
      h.n = 1;
      h.who = `the eldest child of ${h.name}`;
      h.name = `${h.name}'s son`;
      h.price = Math.round(h.price * 0.5);
      h.daughter = undefined;
      journal(state, `Kept ${h.who} as a hostage, and sold the rest.`);
      break;
    }
    case 'free':
      drop(state, content, h);
      state.honour += 1;
      standing(2);
      journal(state, `Sent ${h.name} home without a ransom.`);
      break;
    case 'dies':
      drop(state, content, h);
      standing(h.state === 'surety' ? -5 : -2);
      journal(state, `${h.name} died in your keeping.`);
      break;
    case 'maybe_dies':
      if (rng.float() < 0.5) hostageOp(state, content, rng, 'dies');
      else journal(state, `${h.name} was sick all winter, and lived.`);
      break;
    case 'escape':
      drop(state, content, h);
      journal(state, `${h.name} escaped.`);
      break;
    case 'foster':
      drop(state, content, h);
      standing(4);
      addDeed(state, content, { type: 'deed', text: `Fostered ${h.name} and sent him home a man`, weight: 4 });
      journal(state, `Sent ${h.name} home, raised in your hall.`);
      break;
    case 'marry':
      state.base.wife = h.daughter ?? h.name;
      drop(state, content, h);
      standing(3);
      journal(state, `Married ${state.base.wife}, of the ${peopleName(h.people)}; her kin went home without paying.`);
      break;
    case 'hand_over':
      drop(state, content, h);
      shiftFavour(state, 2);
      journal(state, `Handed ${h.name} over to the jarl.`);
      break;
  }
}

/** The year's turn: their keep, the sureties' tribute, and the peace that sometimes breaks. */
export function hostageYear(state: GameState, content: ContentBundle, rng: RngCursor): string[] {
  const all = hostagesOf(state);
  if (!all.length) return [];
  const lines: string[] = [];
  const keep = all.reduce((n, h) => n + h.n, 0) * HOSTAGE.keep;
  state.silver -= keep;
  let tribute = 0;
  for (const h of all) {
    if (h.state !== 'surety') continue;
    if (rng.float() < HOSTAGE.breakChance) {
      h.broken = true;
      state.flags.hs_we_broke = 0;
      if (!state.queue.some((q) => q.scene === 'hs_broken')) state.queue.push({ scene: 'hs_broken', day: state.day });
      continue;
    }
    const t = Math.round(h.price * HOSTAGE.tribute);
    tribute += t;
  }
  state.silver += tribute;
  lines.push(`Your hostages, ${plural(all.reduce((n, h) => n + h.n, 0), 'mouth')}, cost ${formatSilver(keep)} in food and guarding this winter.${tribute ? ` Their kin's tribute comes in: ${formatSilver(tribute)}.` : ''}`);
  for (const h of all) if (h.captain) shiftRel(state, content, h.captain, -1);
  return lines;
}

/** He raided a people whose surety he holds: the peace he sold them is broken, by him. */
export function brokePeace(state: GameState, placeId: string, content: ContentBundle): void {
  const people = content.places[placeId]?.people;
  const h = hostagesOf(state).find((x) => x.state === 'surety' && x.people === people);
  if (!h) return;
  h.broken = true;
  state.flags.hs_we_broke = 1;
  if (!state.queue.some((q) => q.scene === 'hs_broken')) state.queue.push({ scene: 'hs_broken', day: state.day });
}
