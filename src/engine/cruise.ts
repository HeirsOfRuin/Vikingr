// Going a-viking along a coast on standing orders (docs/FRAME-PACING.md, option 2). The captain sets the orders;
// the same engine sails, scouts, fights and plunders as if he tapped every button himself; and it stops for him
// whenever something needs him: a scene, a fight he said he would lead, a bad wound, heavy losses, full holds,
// empty stores. Before he sets out, his men's reckoning comes from the same engine: the summer run twenty times.
import type { ContentBundle } from '../content/schema';
import type { GameState, Position } from './state';
import { RngCursor, seedRng } from './rng';
import { dateOf, dayOf } from './calendar';
import { hpMax } from './hero';
import { aliveMen, mouths, payShip, purse } from './crew';
import { holdRoom } from './fleet';
import { finishBattle, startRaid } from './fights';
import { fightOutHostWall } from './host';
import { fightOutWall } from './wall';
import { plunderAction, type PlunderWhat } from './plunder';
import { scoutedOdds, scoutedThisYear, scoutPlace } from './scout';
import { coursePath, sailCourse } from './course';
import { routes, runVoyage, startVoyage } from './voyage';
import { resupplyCost, RESUPPLY_DAYS, tierAt } from './standing';
import { formatSilver, plural } from './format';
import { journal } from './journal';
import { LATE_SEASON_DOY } from './tuning';

export type Aim = 'silver' | 'balance' | 'captives';
export type Boldness = 'careful' | 'bold';
export type Lead = 'all' | 'close' | 'none';
export interface CruiseOrders { coast: string; days: number; aim: Aim; bold: Boldness; lead: Lead; then: 'stay' | 'home' }
export interface CruiseState {
  orders: CruiseOrders;
  until: number;
  menAtStart: number;
  lootAtStart: number;
  captivesAtStart: number;
  log: string[];
  /** Places raided, or looked at and left alone, this cruise. */
  done: string[];
}

export const CRUISE = {
  /** The days he can give it; 0 is the rest of the summer. */
  lengths: [10, 20, 30, 0],
  /** Careful leaves a place alone if the scouts count more than this many of them to each of his; bold, more than this. */
  nerve: { careful: 0.9, bold: 1.5 } as Record<Boldness, number>,
  /** "Call me when it's close": he leads any raid where they could field more than this to each of his men. */
  close: 0.6,
  /** Plunder until the alarm reaches this, then back to the ships. */
  alarmStop: { careful: 6, bold: 8 } as Record<Boldness, number>,
  /** It stops for him: blood below this share, men below this share of the start, holds this near full, food for so few days. */
  woundAt: 0.4,
  lossesAt: 0.65,
  holdAt: 150,
  foodDays: 6,
  /** The reckoning: the summer run this many times. */
  forecastRuns: 20,
  guard: 80,
} as const;

export const AIM_LABEL: Record<Aim, string> = { silver: 'Silver', balance: 'Silver and captives', captives: 'Captives' };
export const BOLD_LABEL: Record<Boldness, string> = { careful: 'Careful', bold: 'Bold' };
export const LEAD_LABEL: Record<Lead, string> = { all: 'Every fight', close: 'The close ones', none: 'None: the men handle them' };

/** Raidable places he knows on a coast, not taken this summer, not held by the Norse, not done this cruise. */
export function coastTargets(state: GameState, content: ContentBundle, coast: string, done: string[] = []): string[] {
  const c = content.coasts[coast];
  if (!c) return [];
  return state.known.filter((id) => {
    const p = content.places[id];
    if (!p?.raid || p.active === false || !c.regions.includes(p.region) || state.places[id]?.norse || state.seasonRaids.includes(id) || done.includes(id)) return false;
    // a place he knows of but has no known sea road to is not a target
    return !state.at || state.at === id || !!coursePath(state, content, state.at, id);
  });
}

export function cruiseUntil(state: GameState, days: number): number {
  const end = dayOf(dateOf(state.day).year, LATE_SEASON_DOY);
  return days ? Math.min(end + 30, state.day + days) : Math.max(state.day + 5, end);
}

/** The orders a plan starts from: the coast with the most he knows, the rest of the summer, and caution. */
export function defaultOrders(state: GameState, content: ContentBundle): CruiseOrders | null {
  const coasts = Object.keys(content.coasts).map((id) => ({ id, n: coastTargets(state, content, id).length })).filter((c) => c.n > 0).sort((a, b) => b.n - a.n);
  if (!coasts.length) return null;
  return { coast: coasts[0]!.id, days: 0, aim: 'balance', bold: 'careful', lead: 'close', then: 'home' };
}

export function startCruise(state: GameState, content: ContentBundle, orders: CruiseOrders): void {
  state.cruise = { orders, until: cruiseUntil(state, orders.days), menAtStart: state.crew.men, lootAtStart: state.loot, captivesAtStart: state.captives, log: [], done: [] };
  delete state.course;
  journal(state, `Set out a-viking: ${content.coasts[orders.coast]?.name ?? orders.coast}.`);
}

/** What has the stage (read fresh: the engine calls in between change it). */
const pendingT = (state: GameState): string | undefined => (state.pending as GameState['pending'])?.t;

const dayWord = (state: GameState) => {
  const d = dateOf(state.day);
  return `${d.dom} ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.month]}`;
};

/** Why the cruise should stop for him now, or null. */
function stopReason(state: GameState, content: ContentBundle): string | null {
  const c = state.cruise!;
  if (!state.hero.alive) return 'dead';
  if (state.day >= c.until) return 'The days you gave it are spent.';
  if (state.hero.hp < hpMax(state, content) * CRUISE.woundAt) return 'You are hurt badly enough that your men won\'t go on without your word.';
  if (state.crew.men < c.menAtStart * CRUISE.lossesAt) return `You have lost ${plural(c.menAtStart - state.crew.men, 'man', 'men')} since you set out. The men want your word before they go on.`;
  if (holdRoom(state, content) < CRUISE.holdAt) return 'The holds are full.';
  return null;
}

/** Why the men can't set out at all, or null: the same tests that would stop them on the first day. */
export function cruiseBlock(state: GameState, content: ContentBundle): string | null {
  if (state.hero.hp < hpMax(state, content) * CRUISE.woundAt) return 'You are too badly hurt to lead men out. Rest first.';
  if (holdRoom(state, content) < CRUISE.holdAt) return 'The holds are full. Share out the plunder, or sell, first.';
  if (state.provisions < mouths(state) * CRUISE.foodDays && !(state.at && resupplyCost(state, content, state.at)?.need && purse(state) > 0)) return 'Not enough food, and nobody here will sell you more.';
  return null;
}

/** Food, bought where they will sell it, before the next leg. */
function victual(state: GameState, content: ContentBundle): string | null {
  if (state.provisions >= mouths(state) * CRUISE.foodDays || !state.at) return null;
  const rc = resupplyCost(state, content, state.at);
  if (rc && rc.need > 0 && purse(state) > 0 && tierAt(state, content, state.at) !== 'hostile') {
    const pay = Math.min(rc.cost, purse(state));
    payShip(state, pay);
    state.provisions += rc.cost ? Math.round((rc.need * pay) / rc.cost) : 0;
    state.day += 1;
    return `${dayWord(state)}: food bought at ${content.places[state.at]!.name} for ${RESUPPLY_DAYS} days, ${formatSilver(pay)}.`;
  }
  return state.provisions < mouths(state) * 2 ? 'The food is nearly gone, and nobody on this shore will sell you more.' : null;
}

/** The plunder rounds, by his orders: what to take, and how long to stay. */
function autoPlunder(state: GameState, content: ContentBundle, rng: RngCursor, o: CruiseOrders): void {
  let round = 0;
  while (state.pending?.t === 'plunder' && round++ < 12) {
    const p = state.pending.plunder;
    const what: PlunderWhat = p.alarm >= CRUISE.alarmStop[o.bold] ? 'leave'
      : o.aim === 'silver' ? 'grab' : o.aim === 'captives' ? 'captives' : round % 2 ? 'grab' : 'captives';
    plunderAction(state, content, rng, what);
  }
}

/** The men fight it: deployment, the wall, the aftermath, the plunder; the same functions as his own buttons. */
function autoFight(state: GameState, content: ContentBundle, rng: RngCursor, o: CruiseOrders): string[] {
  const pd = state.pending;
  if (pd?.t !== 'battle') return [];
  const b = pd.battle;
  if (b.host) fightOutHostWall(b, rng); else fightOutWall(b, rng);
  finishBattle(state, content, rng, b);
  autoPlunder(state, content, rng, o);
  const rep = state.pending as { t: string; lines?: string[] } | null;
  const lines = rep?.t === 'report' ? rep.lines ?? [] : [];
  if (rep?.t === 'report') state.pending = null;
  return lines;
}

/** Sails, scouts, raids, along the coast, until the orders are done or something needs him. */
export function runCruise(state: GameState, content: ContentBundle, rng: RngCursor, sim = false): string[] {
  const c = state.cruise;
  if (!c) return [];
  const o = c.orders;
  const lines: string[] = [];
  let guard = 0;
  while (state.cruise && !state.pending && state.hero.alive && guard++ < CRUISE.guard) {
    const why = stopReason(state, content);
    if (why) { lines.push(...endCruise(state, content, rng, why, sim)); break; }
    const food = victual(state, content);
    if (food) { c.log.push(food); if (state.provisions < mouths(state) * 2) { lines.push(...endCruise(state, content, rng, food, sim)); break; } }
    // a leg broken off at sea (a scene, passed over in the reckoning): sail it out
    if (state.voyage) {
      const r = runVoyage(state, content, rng);
      if (sim && pendingT(state) === 'scene') state.pending = null;
      const land = r.lines.filter((l) => !/^Landfall at/.test(l));
      if (land.length) c.log.push(`${dayWord(state)}${state.at ? `, ${content.places[state.at]!.name}` : ''}: ${land.join(' ')}`);
      continue;
    }
    const at = state.at;
    if (!at) break;
    // the nearest place on the coast not yet done
    const targets = coastTargets(state, content, o.coast, c.done)
      .map((id) => ({ id, d: id === at ? 0 : coursePath(state, content, at, id)?.days ?? 999 }))
      .filter((t) => t.d < 999).sort((a, b) => a.d - b.d);
    const next = targets[0]?.id;
    if (!next) { lines.push(...endCruise(state, content, rng, 'There is nothing left on this coast that you know of.', sim)); break; }
    if (next !== at) {
      const hop = coursePath(state, content, at, next)!.path[0]!;
      const legDays = routes(state, content, at).find((r) => r.to === hop)?.days ?? 1;
      if (state.provisions < mouths(state) * Math.ceil(legDays)) { lines.push(...endCruise(state, content, rng, 'Not enough food for the next leg.', sim)); break; }
      startVoyage(state, content, hop);
      const r = runVoyage(state, content, rng);
      const land = r.lines.filter((l) => !/^Landfall at/.test(l));
      // a quiet landfall is not worth a line; a storm, a story told on the beach, is
      if (land.length) c.log.push(`${dayWord(state)}${state.at ? `, ${content.places[state.at]!.name}` : ''}: ${land.join(' ')}`);
      if (sim && pendingT(state) === 'scene') state.pending = null;
      continue;
    }
    // here: look first, then decide
    const name = content.places[at]!.name;
    if (!scoutedThisYear(state, at)) scoutPlace(state, content, rng, at);
    const odds = scoutedOdds(state, content, at);
    const ours = state.crew.men + aliveMen(state).length;
    const expected = odds ? odds.p * odds.asleep + (1 - odds.p) * odds.awake : null;
    if (expected === null ? o.bold === 'careful' : expected > ours * CRUISE.nerve[o.bold]) {
      c.done.push(at);
      c.log.push(`${dayWord(state)}: ${name}. ${expected === null ? 'Your scouts were seen; the place is warned.' : `About ${Math.round(expected)} of them against your ${ours}.`} You leave it alone.`);
      continue;
    }
    const before = { loot: state.loot, captives: state.captives, men: state.crew.men };
    startRaid(state, content, rng, at);
    c.done.push(at);
    const lead = !sim && (o.lead === 'all' || (o.lead === 'close' && (expected === null || expected > ours * CRUISE.close)));
    if (lead) {
      c.log.push(`${dayWord(state)}: ${name}. You lead the raid yourself.`);
      break;
    }
    const fought = autoFight(state, content, rng, o);
    const won = state.places[at]!.wonOn === state.day || state.loot > before.loot;
    c.log.push(`${dayWord(state)}: ${name}. ${won ? 'Taken' : 'Beaten off'}: ${formatSilver(Math.max(0, state.loot - before.loot))}${state.captives > before.captives ? `, ${plural(state.captives - before.captives, 'captive')}` : ''}; ${plural(Math.max(0, before.men - state.crew.men), 'man', 'men')} lost.`);
    void fought;
    if (sim && pendingT(state) === 'scene') state.pending = null;
  }
  return lines;
}

/** The cruise is over: what it brought, and (if the orders say so) the road home. */
export function endCruise(state: GameState, content: ContentBundle, rng: RngCursor, why: string, sim = false): string[] {
  const c = state.cruise;
  if (!c) return [];
  delete state.cruise;
  if (why === 'dead' || !state.hero.alive) return [];
  const lines = [why, ...c.log.slice(-14)];
  lines.push(`In all: ${formatSilver(Math.max(0, state.loot - c.lootAtStart))} on the heap${state.captives > c.captivesAtStart ? `, ${plural(state.captives - c.captivesAtStart, 'captive')}` : ''}; ${plural(Math.max(0, c.menAtStart - state.crew.men), 'man', 'men')} fewer at the oars than when you set out.`);
  if (c.orders.then === 'home' && state.at !== (state.homeAt ?? 'home_fjord') && !state.pending) {
    state.course = state.homeAt ?? 'home_fjord';
    const home = sailCourse(state, content, rng);
    if (sim && pendingT(state) === 'scene') state.pending = null;
    lines.push(...home.filter((l) => !/^Landfall at/.test(l)).slice(-4));
  }
  return lines;
}

export interface Reckoning { runs: number; deaths: number; loot: number; captives: number; lost: number }
const cache = new Map<string, Reckoning>();

/** The men's reckoning: the same summer, run on the same engine, with every fight left to them and the sea's
 *  scenes passed over. What it counts is what the engine does, not a second formula. */
export function forecast(state: GameState, content: ContentBundle, orders: CruiseOrders): Reckoning {
  const key = JSON.stringify([orders, state.day, state.crew, state.hero.hp, state.position, state.at, state.seed, state.stats.battles]);
  const hit = cache.get(key);
  if (hit) return hit;
  const r: Reckoning = { runs: CRUISE.forecastRuns, deaths: 0, loot: 0, captives: 0, lost: 0 };
  for (let i = 0; i < CRUISE.forecastRuns; i++) {
    const s = structuredClone({ ...state, pending: null, journal: [], deeds: [...state.deeds] }) as GameState;
    const rng = new RngCursor(seedRng((state.seed ^ (i * 2654435761) ^ state.day) >>> 0));
    startCruise(s, content, { ...orders, lead: 'none', then: 'stay' });
    runCruise(s, content, rng, true);
    if (!s.hero.alive) { r.deaths++; continue; }
    r.loot += Math.max(0, s.loot - state.loot);
    r.captives += Math.max(0, s.captives - state.captives);
    r.lost += Math.max(0, state.crew.men - s.crew.men);
  }
  const alive = Math.max(1, r.runs - r.deaths);
  r.loot = Math.round(r.loot / alive);
  r.captives = Math.round(r.captives / alive);
  r.lost = Math.round(r.lost / alive);
  if (cache.size > 200) cache.clear();
  cache.set(key, r);
  return r;
}

export function reckoningWords(r: Reckoning): string {
  const death = r.deaths === 0 ? `none of ${r.runs} summers like it killed a captain in your place` : `${r.deaths} summers in ${r.runs} like it killed a captain in your place`;
  return `Your men's reckoning: ${death}. The rest brought home about ${formatSilver(r.loot)}${r.captives ? ` and ${plural(r.captives, 'captive')}` : ''}, for ${plural(r.lost, 'man', 'men')} lost.`;
}

export const POSITION_WORDS: Record<Position, string> = { front: 'In the front rank', wall: 'In the wall', rear: 'Behind the wall' };
