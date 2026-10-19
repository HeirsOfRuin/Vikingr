// Lords (docs/FRAME-WORLD.md §C): one oath at a time. A lord gives men, protection, a seat to winter at, and
// land; he asks for his call answered, a tenth of the heap, and his friends left alone. A second oath, kept
// secret, comes out in the end: then honour falls and both lords cast him out (Josh's rule).
import type { ContentBundle } from '../content/schema';
import type { GameState } from './state';
import type { RngCursor } from './rng';
import { dateOf } from './calendar';
import { journal } from './journal';
import { favour, shiftFavour } from './allies';
import { formatSilver } from './format';
import { shiftStanding } from './standing';

export const LORD = {
  min: -10,
  max: 10,
  /** His favour before he will take your oath (an outlaw at Harek's table: any that isn't ill will). */
  swearAt: 2,
  outlawSwearAt: 0,
  /** Leaving a lord openly. */
  leave: 3,
  /** A second oath kept secret: the chance a year it comes out (and for certain if both lords call in one summer). */
  foundBase: 0.3,
  foundPerYear: 0.15,
  castHonour: 3,
  castStanding: 3,
  /** The lord's part of every share-out. */
  tenth: 0.1,
  /** Men his lord sends to the muster: a base, and one for every few points of favour. */
  menBase: 2,
  menPer: 3,
  /** His ports never treat the lord's man as worse than this. */
  floor: 2,
  /** Favour for a grant of land (with a call answered). */
  grantAt: 6,
  /** A raid on the lord's friends. */
  raidFriend: 4,
  answer: 2,
  refuse: 3,
  /** A lord's call, a year. */
  call: 0.35,
} as const;

export interface LordState { fav: number; met?: boolean; cast?: number; answered?: number }
export interface Oath { lord: string; since: number }

function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function lordState(state: GameState, id: string): LordState {
  state.lords ??= {};
  return (state.lords[id] ??= { fav: 0 });
}

/** His favour: the jarl's is the old district favour; every other lord's is his own. */
export function lordFav(state: GameState, id: string): number {
  return id === 'jarl' ? favour(state) : state.lords?.[id]?.fav ?? 0;
}

export function shiftLordFav(state: GameState, id: string, n: number): void {
  if (id === 'jarl') { shiftFavour(state, n); return; }
  const l = lordState(state, id);
  l.fav = Math.max(LORD.min, Math.min(LORD.max, l.fav + n));
}

export function lordName(state: GameState, content: ContentBundle, id: string): string {
  if (id === 'jarl') return state.flags.fr_jarl_hakon ? 'Jarl Hákon' : state.flags.fr_jarl_eirik ? 'Jarl Eiríkr' : 'Jarl Eystein';
  const d = content.lords[id]!;
  const year = dateOf(state.day).year;
  return [...(d.names ?? [])].reverse().find((n) => year >= n.from)?.name ?? d.name;
}

/** The year he dies, if the registry gives a span: the same year for the same life. */
export function lordDies(state: GameState, content: ContentBundle, id: string): number | null {
  const d = content.lords[id]?.dies;
  if (!d) return null;
  return d[0] + (hashOf(`${state.seed}:${id}`) % (d[1] - d[0] + 1));
}

export function lordAlive(state: GameState, content: ContentBundle, id: string): boolean {
  const d = content.lords[id];
  if (!d) return false;
  const year = dateOf(state.day).year;
  const dies = lordDies(state, content, id);
  return year >= d.from && year <= d.to && (dies === null || year < dies) && !state.flags[`lord_dead_${id}`];
}

export function oathLord(state: GameState): string | null {
  return state.oath?.lord ?? null;
}

export function swornTo(state: GameState, id: string): boolean {
  return state.oath?.lord === id || state.oath2?.lord === id;
}

export function oaths(state: GameState): number {
  return (state.oath ? 1 : 0) + (state.oath2 ? 1 : 0);
}

export function outlawed(state: GameState): boolean {
  return !!state.flags.outlawed && !state.flags.outlaw_ended;
}

/** Why he can't offer his oath to this lord now, or null. */
export function swearBlock(state: GameState, content: ContentBundle, id: string): string | null {
  const l = state.lords?.[id];
  const name = lordName(state, content, id);
  if (!lordAlive(state, content, id)) return `${name} is not in the world to swear to.`;
  if (l?.cast !== undefined) return `${name} cast you out. He will not take your oath again.`;
  if (swornTo(state, id)) return `You are ${name}'s man already.`;
  if (state.oath2) return 'You are sworn to two lords already. That is one too many.';
  if (id === 'jarl' && outlawed(state)) return 'An outlaw cannot swear to the jarl who outlawed him.';
  const need = id === 'harek' && outlawed(state) ? LORD.outlawSwearAt : LORD.swearAt;
  if (lordFav(state, id) < need) return `${name} doesn't know you well enough to take your oath. Serve him first.`;
  return null;
}

function loseGrants(state: GameState, content: ContentBundle, id: string, lines: string[]): void {
  const lost = (state.holdings ?? []).filter((h) => h.lord === id);
  if (!lost.length) return;
  state.holdings = (state.holdings ?? []).filter((h) => h.lord !== id);
  for (const h of lost) {
    lines.push(`The land at ${content.places[h.place]!.name} goes back to ${lordName(state, content, id)}.`);
    journal(state, `Lost the land at ${content.places[h.place]!.name}.`);
  }
}

/** He swears to a lord: his first oath, or leaving his old lord openly, or a second oath kept secret. */
export function swear(state: GameState, content: ContentBundle, id: string, how: 'first' | 'open' | 'secret'): string[] {
  const lines: string[] = [];
  const name = lordName(state, content, id);
  const l = lordState(state, id);
  l.met = true;
  const old = state.oath?.lord;
  if (how === 'secret' && old) {
    state.oath2 = { lord: id, since: state.day };
    journal(state, `Swore to ${name}, and said nothing to ${lordName(state, content, old)}.`);
    lines.push(`You put your hands between ${name}'s and say the words. You do not say that you have said them before, to ${lordName(state, content, old)}. Nobody asks.`);
    lines.push('A man with two lords serves neither for long. Every year it stays hidden, the chance grows that someone talks.');
    return lines;
  }
  if (how === 'open' && old) {
    shiftLordFav(state, old, -LORD.leave);
    loseGrants(state, content, old, lines);
    lines.unshift(`You send ${lordName(state, content, old)} back his oath, openly, with a messenger and a gift, the way it should be done. He takes the gift. He will not forget it.`);
    journal(state, `Gave back his oath to ${lordName(state, content, old)}.`);
  }
  state.oath = { lord: id, since: state.day };
  shiftLordFav(state, id, 1);
  journal(state, `Swore his oath to ${name}.`);
  lines.push(`You kneel to ${name} in his hall, put your hands between his, and say the words in front of his men. You are his man now: his call is yours to answer, his friends are yours to leave alone, and a tenth of what you take is his.`);
  return lines;
}

/** He gives back his oath, openly. Not oath-breaking; but the lord remembers, and his land goes back to him. */
export function renounce(state: GameState, content: ContentBundle, id: string): string[] {
  const lines: string[] = [];
  const name = lordName(state, content, id);
  shiftLordFav(state, id, -LORD.leave);
  if (state.oath?.lord === id) { state.oath = state.oath2 ?? undefined; delete state.oath2; }
  else if (state.oath2?.lord === id) delete state.oath2;
  lines.push(`You send ${name} back his oath, with a messenger and a gift. He takes the gift.`);
  loseGrants(state, content, id, lines);
  journal(state, `Gave back his oath to ${name}.`);
  return lines;
}

/** Found out with two lords: honour falls, and both cast him out (Josh's rule, docs/FRAME-WORLD.md §C). */
export function castOut(state: GameState, content: ContentBundle): string[] {
  const ids = [state.oath?.lord, state.oath2?.lord].filter((x): x is string => !!x);
  const names = ids.map((id) => lordName(state, content, id));
  const lines: string[] = [`It comes out, as it was always going to: you are sworn to ${names.join(' and to ')}. Men who took your word now know what it is worth.`];
  state.honour = Math.max(-10, state.honour - LORD.castHonour);
  for (const id of ids) {
    const l = lordState(state, id);
    if (id === 'jarl') state.favour = LORD.min; else l.fav = LORD.min;
    l.cast = state.day;
    loseGrants(state, content, id, lines);
    for (const p of content.lords[id]!.friends) shiftStanding(state, content, p, -LORD.castStanding);
  }
  delete state.oath;
  delete state.oath2;
  state.flags.oathbreaker = (state.flags.oathbreaker ?? 0) + 1;
  state.castBy = names;
  lines.push(`Both of them cast you out. Neither will take your oath again, and their ports will remember it.`);
  journal(state, `Found out sworn to ${names.join(' and ')}: cast out by both.`);
  return lines;
}

/** A secret oath at the turn of the year: older secrets are harder to keep. */
export function secretChance(state: GameState): number {
  if (!state.oath2) return 0;
  const years = dateOf(state.day).year - dateOf(state.oath2.since).year;
  return Math.min(1, LORD.foundBase + LORD.foundPerYear * Math.max(0, years - 1));
}

export function secretYear(state: GameState, content: ContentBundle, rng: RngCursor): string[] {
  if (!state.oath2) return [];
  return rng.float() < secretChance(state) ? castOut(state, content) : [];
}

/** His lord's call, answered or refused. Both his lords calling in the same summer: it comes out for certain. */
export function answerCall(state: GameState, content: ContentBundle, rng: RngCursor, id: string, answered: boolean): string[] {
  void rng;
  delete state.flags[`call_${id}`];
  if (!answered) { shiftLordFav(state, id, -LORD.refuse); return []; }
  shiftLordFav(state, id, LORD.answer);
  lordState(state, id).answered = dateOf(state.day).year;
  state.flags[`served_${id}`] = 1;
  const other = state.oath?.lord === id ? state.oath2?.lord : state.oath2?.lord === id ? state.oath?.lord : undefined;
  if (other && (state.flags[`call_${other}`] || state.lords?.[other]?.answered === dateOf(state.day).year)) return castOut(state, content);
  return [];
}

/** Men his lord sends to his muster. */
export function lordMen(state: GameState): number {
  const id = state.oath?.lord;
  if (!id) return 0;
  return Math.max(0, LORD.menBase + Math.floor(lordFav(state, id) / LORD.menPer));
}

/** The lord's tenth of a share-out. */
export function lordTenth(state: GameState, content: ContentBundle, pot: number): { cut: number; line: string | null } {
  const ids = [state.oath?.lord, state.oath2?.lord].filter((x): x is string => !!x);
  if (!ids.length || pot <= 0) return { cut: 0, line: null };
  const each = Math.round(pot * LORD.tenth);
  const cut = each * ids.length;
  const line = ids.length === 1
    ? `${lordName(state, content, ids[0]!)}'s tenth: ${formatSilver(each)}.`
    : `${lordName(state, content, ids[0]!)}'s tenth, and ${lordName(state, content, ids[1]!)}'s, quietly, by another road: ${formatSilver(cut)}.`;
  return { cut, line };
}

/** His lords' friends: the places he must not raid. */
export function friendsOf(state: GameState, content: ContentBundle, place: string): string[] {
  return [state.oath?.lord, state.oath2?.lord].filter((x): x is string => !!x && content.lords[x]!.friends.includes(place));
}

/** He raided a lord's friend. Below nothing, the lord gives him back his oath. */
export function raidedFriend(state: GameState, content: ContentBundle, place: string): string[] {
  const lines: string[] = [];
  for (const id of friendsOf(state, content, place)) {
    shiftLordFav(state, id, -LORD.raidFriend);
    const name = lordName(state, content, id);
    if (lordFav(state, id) < 0) {
      lines.push(`${name} hears what you did at ${content.places[place]!.name}, and sends you back your oath. You are no man of his now.`);
      if (state.oath?.lord === id) { state.oath = state.oath2 ?? undefined; delete state.oath2; } else delete state.oath2;
      loseGrants(state, content, id, lines);
      journal(state, `${name} gave him back his oath.`);
    } else lines.push(`${name} will hear what you did at ${content.places[place]!.name}. It was under his peace.`);
  }
  return lines;
}

/** The floor his lords' protection puts under his standing in their ports. */
export function standingFloor(state: GameState, content: ContentBundle, place: string): number | null {
  return friendsOf(state, content, place).length ? LORD.floor : null;
}

/** At his lord's own hall: he winters there as at home. */
export function atLordSeat(state: GameState, content: ContentBundle): boolean {
  const id = state.oath?.lord;
  return !!id && id !== 'jarl' && content.lords[id]!.seat === state.at && lordAlive(state, content, id);
}

/** A lord who has died: his man's oath dies with him (docs/FRAME-WORLD.md §E has the succession). */
export function lordsYear(state: GameState, content: ContentBundle, rng: RngCursor): string[] {
  const lines: string[] = [];
  // a call nobody answered is a call refused
  for (const id of Object.keys(content.lords)) if (state.flags[`call_${id}`]) {
    delete state.flags[`call_${id}`];
    shiftLordFav(state, id, -LORD.refuse);
    lines.push(`${lordName(state, content, id)} called for his men last summer, and you never came. He has not forgotten.`);
  }
  for (const k of ['oath', 'oath2'] as const) {
    const o = state[k];
    if (!o || lordAlive(state, content, o.lord)) continue;
    lines.push(`${lordName(state, content, o.lord)} is dead. Your oath died with him.`);
    journal(state, `${lordName(state, content, o.lord)} died. His man no longer.`);
    delete state[k];
  }
  if (!state.oath && state.oath2) { state.oath = state.oath2; delete state.oath2; }
  // this summer's calls: about one year in three, each lord he is sworn to wants his ships (the jarl's levy is the district's)
  for (const o of [state.oath, state.oath2]) if (o && o.lord !== 'jarl' && rng.float() < LORD.call) state.flags[`call_${o.lord}`] = 1;
  return lines;
}
