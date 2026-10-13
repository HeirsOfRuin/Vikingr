// Hardship (docs/FRAME-HARDSHIP.md): what holds a life back from climbing without limit. Upkeep that grows with
// his size; envy that grows with his name; harvests, sickness and fire; coasts that learn; a body that ages.
// The brake is progressive: it bites the great, and leaves a floor under the ruined.
import type { ContentBundle } from '../content/schema';
import type { GameState } from './state';
import type { RngCursor } from './rng';
import { dateOf } from './calendar';
import { livingFame } from './fame';
import { aliveMen, addLoyalty, clampMorale, mouths } from './crew';
import { addWound } from './hero';
import { formatSilver, plural } from './format';
import { journal } from './journal';
import { benchHeir } from './fights';
import { ORTUG_PER_MARK } from './tuning';

export interface HardState {
  /** How far he stands out from his peers, 0..10: at thresholds, men move against him. */
  envy: number;
  /** Open-handedness this year: it takes envy off at the turn of the year. */
  gave: number;
  /** Each year's income and upkeep, for the measure and the spring card. */
  ledger: Record<number, { income: number; upkeep: number }>;
  /** What each region remembers of raiders (its people arm, fortify and watch). */
  alarm: Record<string, number>;
  /** The year of the last bad harvest. */
  dearth?: number;
  /** The marks of alarm each region has reached, once told (the journal says each only once). */
  told?: Record<string, number>;
  /** Silver taken from his hoard by raiders at home, for the getting back. */
  stolen?: number;
}

export const UPKEEP = {
  /** A sworn man at his table all winter. */
  sworn: 8,
  /** Winter gifts and Yule meat for an oarsman, and more for every this-much fame. */
  crew: 0.5,
  crewPerFame: 80,
  /** The share of the shortfall in men that goes to other captains. */
  leave: 0.5,
  /** Tar, rope and sail: a share of the hull's price each winter. */
  ship: 0.06,
  /** An unkept ship starts the season this much the worse. */
  unkeptHull: 30,
} as const;

/** The share a man counts as a good summer grows with his captain's name. */
export const EXPECT_PER_FAME = 1 / 120;

export const ENVY = {
  fameFrom: 40, perFame: 25,
  shipsFrom: 2,
  wealthFrom: 30, perMarks: 15,
  hall: 1,
  /** The way to the target in one year. */
  pull: 0.5,
  gifts: { generous: 1, feast: 0.5, jarl: 1, ring: 0.5, stores: 2 },
} as const;

export const DISASTER = {
  harvest: 1 / 6,
  sickBase: 0.04, sickPerMouth: 0.002, sickMax: 0.25, sickAbroad: 2,
  sickLoss: [0.1, 0.25] as const,
  sickSworn: 0.25,
  sickHero: 0.3,
  fire: 1 / 25, fireEnvy: 0.2,
} as const;

export const COAST = {
  raid: 0.5, burned: 0.25,
  decay: 0.6,
  perAlarm: 0.06, maxMult: 1.6,
  plunderPerAlarm: 0.15, plunderMax: 1.5,
  marks: [2, 4] as const,
} as const;

/** Men who sign on for the promise of a share when he can't pay the gift: the floor under a ruined man. */
export const PROMISE = { base: 6, perFame: 10 } as const;

/** For the measure only: brakes switched off, to see what each one does (tools/measure-power.ts --off). */
export const ABLATE: Record<string, boolean> = {};

/** Journal lines that mark a setback, for the measure: "[kind] ...". */
export const SETBACK = /^\[(\w+)\]/;

export function hard(state: GameState): HardState {
  const h = (state.hard ??= { envy: 0, gave: 0, ledger: {}, alarm: {} });
  h.gave ??= 0;
  h.ledger ??= {};
  h.alarm ??= {};
  return h;
}

/** A setback, in the journal where the measure and the saga can find it. */
export function setback(state: GameState, kind: string, text: string): void {
  journal(state, `[${kind}] ${text}`);
}

/** The ledger: silver he earned this year, by the year of the summer it was earned in. */
export function earn(state: GameState, n: number): void {
  if (n <= 0) return;
  const y = dateOf(state.day).year;
  const l = (hard(state).ledger[y] ??= { income: 0, upkeep: 0 });
  l.income += n;
}

/** Open-handedness, counted against envy at the turn of the year. */
export function give(state: GameState, kind: keyof typeof ENVY.gifts): void {
  hard(state).gave += ENVY.gifts[kind];
}

export function shiftEnvy(state: GameState, n: number): void {
  const h = hard(state);
  h.envy = Math.max(0, Math.min(10, Math.round((h.envy + n) * 10) / 10));
}

// ---- upkeep ----

export function upkeepBill(state: GameState, content: ContentBundle): { men: number; sworn: number; ships: number; total: number } {
  if (state.service || ABLATE.upkeep) return { men: 0, sworn: 0, ships: 0, total: 0 };
  const per = UPKEEP.crew + livingFame(state) / UPKEEP.crewPerFame;
  const men = Math.round(state.crew.men * per);
  const sworn = aliveMen(state).filter((m) => m.sworn).length * UPKEEP.sworn;
  const ships = state.ships.reduce((s, sh) => s + Math.round((content.ships[sh.type]?.cost ?? 0) * UPKEEP.ship), 0);
  return { men, sworn, ships, total: men + sworn + ships };
}

/** The winter's bills, set aside when the heap is divided in autumn: the men first, then the ships. Silver, then the
 *  hoard. Returns the share-out's lines. */
export function payUpkeep(state: GameState, content: ContentBundle): string[] {
  const year = dateOf(state.day).year;
  const bill = upkeepBill(state, content);
  if (!bill.total) return [];
  const lines: string[] = [];
  // off the heap first, as every ship's cost is, so the men's shares carry their own winter; then his silver; then the hoard
  const pay = (n: number) => {
    const fromHeap = Math.min(n, state.loot);
    state.loot -= fromHeap;
    const fromSilver = Math.min(n - fromHeap, state.silver);
    state.silver -= fromSilver;
    const fromHoard = Math.min(n - fromHeap - fromSilver, state.base.hoard);
    state.base.hoard -= fromHoard;
    return fromHeap + fromSilver + fromHoard;
  };
  const menOwed = bill.men + bill.sworn;
  const menPaid = pay(menOwed);
  const shipsPaid = pay(bill.ships);
  const paid = menPaid + shipsPaid;
  (hard(state).ledger[year] ??= { income: 0, upkeep: 0 }).upkeep += paid;
  lines.push(`Before the heap is divided, the winter's keep comes off the top: ${formatSilver(bill.men + bill.sworn)} for the men's meat and Yule gifts, ${formatSilver(bill.ships)} for tar, rope and sailcloth.`);
  if (menPaid < menOwed) {
    // a ship's crew goes home for the winter and comes back hungry; a fleet's extra men go to other captains
    const short = 1 - menPaid / menOwed;
    const flagCrew = content.ships[state.ships[0]?.type ?? '']?.crew ?? 0;
    const leave = Math.round(Math.max(0, state.crew.men - flagCrew) * short * UPKEEP.leave);
    state.crew.men -= leave;
    state.crew.morale -= 1;
    for (const m of aliveMen(state)) addLoyalty(m, -1);
    clampMorale(state);
    if (leave) {
      setback(state, 'unpaid', `Couldn't keep the men through the winter: ${plural(leave, 'man', 'men')} went to other captains.`);
      lines.push(`You couldn't feed them all. ${plural(leave, 'man', 'men')} went home hungry, and in the spring they'll row for somebody who can.`);
    } else lines.push('There was not enough to give the men their Yule gifts. They go home for the winter with empty hands, and say so.');
  }
  if (shipsPaid < bill.ships) {
    // the newest ships go untarred first; the crew patch the flagship with what's to hand, as poor men always have
    let short = bill.ships - shipsPaid;
    for (const sh of state.ships.slice(1).reverse()) {
      if (short <= 0) break;
      short -= Math.round((content.ships[sh.type]?.cost ?? 0) * UPKEEP.ship);
      sh.hull = Math.max(10, sh.hull - UPKEEP.unkeptHull);
    }
    // a fleet left to rot is a setback; one old ship patched with what's to hand is just being poor
    if (state.ships.length > 1) {
      setback(state, 'unpaid', 'There was no silver to tar the ships: they start the summer leaking.');
      lines.push('There was no silver left for tar and rope. Some of the ships go into the water leaking.');
    }
  }
  return lines;
}

// ---- envy ----

/** How far he stands out from his peers, 0..10: what envy is pulled toward. */
export function outshine(state: GameState): number {
  const fame = Math.max(0, livingFame(state) - ENVY.fameFrom) / ENVY.perFame;
  const ships = Math.max(0, state.ships.length - ENVY.shipsFrom);
  const marks = (state.silver + state.base.hoard) / ORTUG_PER_MARK;
  const wealth = Math.max(0, marks - ENVY.wealthFrom) / ENVY.perMarks;
  const hall = state.base.level === 'hall' ? ENVY.hall : 0;
  return Math.min(10, fame + ships + wealth + hall);
}

export const ENVY_WORDS = ['Nobody grudges you anything.', 'A few men speak of you with an edge.', 'Men talk about you at other men\'s fires, and not all of it kindly.', 'There are men in the district who would be glad to see you fall.', 'You have enemies you have never met.'] as const;
export function envyWords(n: number): string {
  return ENVY_WORDS[Math.min(4, Math.floor(n / 2.5))]!;
}

function turnEnvy(state: GameState): void {
  const h = hard(state);
  if (state.service) { h.gave = 0; return; }
  const target = ABLATE.envy ? 0 : outshine(state);
  h.envy = Math.max(0, Math.min(10, Math.round((h.envy + (target - h.envy) * ENVY.pull - h.gave) * 10) / 10));
  h.gave = 0;
}

// ---- the coast learns ----

const COAST_WORDS: Record<string, [string, string]> = {
  Ireland: ['The Irish kings have started to build ringforts by the shore, and to keep men in them.', 'The kings of Ireland call out their hostings now at the first sail, and the monks bury the shrines before the ships are in sight.'],
  Ulster: ['The Ulstermen keep watch on the headlands now, with fires laid ready.', 'Every church in Ulster has a round tower now, and men in it.'],
  Frankia: ['The Franks have put garrisons at the river mouths.', 'The counts of Frankia muster their horsemen at the first rumour of a fleet.'],
  Frisia: ['The Frisians have built a ring-wall round the market, and keep men on it.', 'The emperor has given the Frisian coast to a count with ships of his own, to keep the Northmen off it.'],
  Northumbria: ['The Northumbrians call out the fyrd at the first sail.', 'There are burhs on the Northumbrian coast now, with ditches and walls.'],
  'The Hebrides': ['The islanders watch the sea now, and drive their cattle inland at a strange sail.', 'The island chiefs have learned to fight together, when ships come.'],
  'The Irish Sea': ['The shores of the Irish Sea are watched now.', 'Every shore of the Irish Sea is armed now.'],
};

export function coastAlarm(state: GameState, region: string): number {
  return hard(state).alarm[region] ?? 0;
}

/** A raid on a place: its whole region remembers. */
export function alarmRegion(state: GameState, content: ContentBundle, placeId: string, burned: boolean): void {
  const region = content.places[placeId]?.region;
  if (!region || content.places[placeId]?.kind === 'home') return;
  const h = hard(state);
  const before = h.alarm[region] ?? 0;
  const after = Math.round((before + COAST.raid + (burned ? COAST.burned : 0)) * 10) / 10;
  h.alarm[region] = after;
  const told = (h.told ??= {});
  COAST.marks.forEach((m, i) => {
    if (after >= m && (told[region] ?? 0) < i + 1) {
      told[region] = i + 1;
      const w = COAST_WORDS[region]?.[i] ?? (i === 0 ? `The people of ${region} watch the sea now.` : `The people of ${region} are armed and ready now, every summer.`);
      setback(state, 'coast', w);
    }
  });
}

/** Defenders at a place, by how much its region has learned. */
export function coastMult(state: GameState, content: ContentBundle, placeId: string): number {
  if (ABLATE.coast) return 1;
  const region = content.places[placeId]?.region;
  return Math.min(COAST.maxMult, 1 + COAST.perAlarm * (region ? coastAlarm(state, region) : 0));
}

/** How quickly a raided region's countryside comes: the plunder rounds start with the alarm already raised. */
export function coastPlunderStart(state: GameState, content: ContentBundle, placeId: string): number {
  if (ABLATE.coast) return 0;
  const region = content.places[placeId]?.region;
  return Math.min(COAST.plunderMax, Math.round(COAST.plunderPerAlarm * (region ? coastAlarm(state, region) : 0) * 10) / 10);
}

// ---- disasters ----

/** Autumn: the harvest. Rolled when he comes home for the winter. A bad one queues the district's need. */
export function rollHarvest(state: GameState, content: ContentBundle, rng: RngCursor, year: number): void {
  const h = hard(state);
  if (ABLATE.disasters || h.dearth === year || h.dearth === year - 1) return;
  if (rng.float() >= DISASTER.harvest) return;
  h.dearth = year;
  const dead = Math.ceil(state.base.thralls / 3);
  state.base.thralls -= dead;
  setback(state, 'harvest', `A bad harvest in ${year}: the barley rotted in the field${dead ? `, and ${plural(dead, 'thrall')} died before spring` : ''}.`);
  if (content.scenes.ha_harvest) state.queue.push({ scene: 'ha_harvest', day: state.day + 1 });
}

/** A bad harvest this winter: the farm yields nothing, and spring food is dear. */
export function dearthOf(state: GameState, winterOf: number): boolean {
  return state.hard?.dearth === winterOf;
}

/** Winter quarters: crowded men and the coughing sickness. Returns the card's lines. */
export function rollSickness(state: GameState, content: ContentBundle, rng: RngCursor, abroad: boolean): string[] {
  const m = mouths(state);
  const p = Math.min(DISASTER.sickMax, DISASTER.sickBase + DISASTER.sickPerMouth * m) * (abroad ? DISASTER.sickAbroad : 1);
  if (state.service || rng.float() >= p || ABLATE.disasters) return [];
  const lines: string[] = [];
  const [lo, hi] = DISASTER.sickLoss;
  const dead = Math.round(state.crew.men * (lo + (hi - lo) * rng.float()));
  state.crew.men -= dead;
  const names: string[] = [];
  const sworn = aliveMen(state);
  if (sworn.length && rng.float() < DISASTER.sickSworn) {
    const man = sworn[rng.int(sworn.length)]!;
    man.alive = false;
    man.diedOn = state.day;
    names.push(man.name);
    const heir = benchHeir(state, content);
    (state.standIns ??= {})[man.id] = heir;
    journal(state, `${man.name} died of the coughing sickness.`);
  }
  setback(state, 'sickness', `The coughing sickness went through the winter quarters: ${plural(dead, 'man', 'men')} died${names.length ? `, and ${names.join(' and ')}` : ''}.`);
  lines.push(`The coughing sickness came in the dark of the winter, the way it does where men sleep close. It took ${plural(dead, 'man', 'men')}${names.length ? `, and ${names.join(' and ')}, who had stood in every wall you ever stood in, and died coughing in the straw` : ''}.`);
  if (rng.float() < DISASTER.sickHero && content.injuries.winter_cough) {
    addWound(state, content, 'winter_cough', 'the winter sickness');
    lines.push('You had it too. You lived. You are still coughing.');
  }
  return lines;
}

/** Fire, at a farm or a hall: rare, and less rare when somebody hates him. Queued into the winter. */
export function rollFire(state: GameState, content: ContentBundle, rng: RngCursor): void {
  if (state.base.level === 'father' || !content.scenes.ha_fire || ABLATE.disasters) return;
  const p = DISASTER.fire * (1 + DISASTER.fireEnvy * hard(state).envy);
  if (rng.float() < p) state.queue.push({ scene: 'ha_fire', day: state.day + 20 + rng.int(60) });
}

/** What he drags out of the burning hall. A hall burned is a farm again, until it is rebuilt. */
export function burn(state: GameState, content: ContentBundle, what: 'hoard' | 'trophies' | 'people'): void {
  const b = state.base;
  const lostHoard = what === 'hoard' ? 0 : what === 'trophies' ? Math.round(b.hoard / 2) : Math.round(b.hoard / 2);
  const lostTrophies = what === 'trophies' ? 0 : what === 'hoard' ? b.trophies.length : Math.ceil(b.trophies.length / 2);
  const lostThralls = what === 'people' ? 0 : Math.ceil(b.thralls / 2);
  b.hoard -= lostHoard;
  b.trophies = b.trophies.slice(0, b.trophies.length - lostTrophies);
  b.thralls -= lostThralls;
  const wasHall = b.level === 'hall';
  if (wasHall) { b.level = 'farm'; state.flags.hall_burned = 1; }
  const lost = [lostHoard ? `${formatSilver(lostHoard)} of the hoard` : '', lostTrophies ? plural(lostTrophies, 'trophy', 'trophies') : '', lostThralls ? plural(lostThralls, 'thrall') : ''].filter(Boolean);
  setback(state, 'fire', `${wasHall ? 'The hall' : 'The longhouse'} burned${lost.length ? `: lost ${lost.join(', ')}` : ''}.`);
  void content;
}

/** Raiders at home while he's away: half the hoard and some thralls gone. */
export function robHoard(state: GameState, frac: number): void {
  const n = Math.round(state.base.hoard * frac);
  state.base.hoard -= n;
  const h = hard(state);
  h.stolen = (h.stolen ?? 0) + n;
  setback(state, 'raided', `Raiders came to the farm while he was away, and dug up ${formatSilver(n)}.`);
}

export function recoverHoard(state: GameState, frac: number): void {
  const h = hard(state);
  const n = Math.round((h.stolen ?? 0) * frac);
  state.base.hoard += n;
  h.stolen = 0;
  if (n) journal(state, `Got back ${formatSilver(n)} of what was taken from the farm.`);
}

/** A ship lost: driven ashore in a storm at anchor, or given away. The worst-kept goes, never the flagship. */
export function loseShip(state: GameState, content: ContentBundle, how: 'wreck' | 'give'): string | null {
  if (state.ships.length < 2 || state.service) return null;
  const rest = state.ships.slice(1).sort((a, b) => a.hull - b.hull);
  const ship = how === 'wreck' ? rest[0]! : rest[rest.length - 1]!;
  const cap = content.ships[ship.type]?.crew ?? 0;
  const total = state.ships.reduce((s, sh) => s + (content.ships[sh.type]?.crew ?? 0), 0);
  const aboard = Math.round((state.crew.men * cap) / Math.max(1, total));
  // in a wreck about a third of her men drown; given away, her crew goes with her
  const gone = how === 'wreck' ? Math.round(aboard / 3) : aboard;
  state.crew.men = Math.max(0, state.crew.men - gone);
  state.ships.splice(state.ships.indexOf(ship), 1);
  if (how === 'wreck') setback(state, 'storm', `${ship.name} was driven ashore at anchor and broke up; ${plural(gone, 'man', 'men')} drowned.`);
  else setback(state, 'jarl', `Gave ${ship.name} to the jarl, and her crew with her.`);
  return ship.name;
}

// ---- the turn of the year ----

/** At the turn of the year: the keep, envy, the coasts' memory fading, the winter sickness. Returns the card's lines. */
export function turnOfYear(state: GameState, content: ContentBundle, rng: RngCursor, year: number, abroad: boolean): string[] {
  const lines: string[] = [];
  lines.push(...rollSickness(state, content, rng, abroad));
  turnEnvy(state);
  const h = hard(state);
  for (const r of Object.keys(h.alarm)) {
    h.alarm[r] = Math.round(h.alarm[r]! * COAST.decay * 10) / 10;
    if (h.alarm[r]! < 0.2) delete h.alarm[r];
  }
  // the ledger keeps three years
  for (const y of Object.keys(h.ledger)) if (Number(y) < year - 3) delete h.ledger[Number(y)];
  return lines;
}

/** How many men will sign on for a promise, this spring, on his name alone. */
export function promiseMen(state: GameState): number {
  if (state.flags.promised === dateOf(state.day).year) return 0;
  return PROMISE.base + Math.floor(livingFame(state) / PROMISE.perFame);
}

/** What a place's winter brings in, after the harvest. */
export function yieldAfterHarvest(state: GameState, n: number): number {
  const w = state.flags._winter;
  return w !== undefined && dearthOf(state, w) ? 0 : n;
}

