// The year at home: spring muster, the autumn share-out and homecoming,
// the winter hall, and the turn of the year.
import type { ContentBundle } from '../content/schema';
import type { GameState } from './state';
import type { RngCursor } from './rng';
import { dateOf, dayOf, nextDoy, formatDate } from './calendar';
import { addDeed, composeVerse, livingFame, tellDeeds, untoldCount } from './fame';
import { addLoyalty, addRecruits, aliveMen, capacity, clampMorale, mouths, SHIP_NAMES } from './crew';
import { effAttr, heal, learn, strawDeathCheck, kill, age } from './hero';
import { formatSilver, plural } from './format';
import { journal } from './journal';
import { trigger } from './director';
import { driftStanding } from './standing';
import {
  HALL_ACTIONS, HALL_ACTION_DAYS, LEADER_SHARE, MUSTER_DOY, ORTUG_PER_MARK, PROVISION_ORTUG_PER, SHARE_EXPECTED, SIGN_ON_GIFT, WINTER_DOY,
} from './tuning';

export const JARL_CUT = 0.25;
export const PROVISION_DAYS = 40;
export const FEAST_GUESTS = 10;

// ---- muster ----

export function recruitable(state: GameState, content: ContentBundle): number {
  return Math.max(0, Math.min(state.musterPool, capacity(state, content) - state.crew.men - aliveMen(state).length, Math.floor(state.silver / SIGN_ON_GIFT)));
}

export function recruit(state: GameState, content: ContentBundle): string[] {
  const n = recruitable(state, content);
  if (n <= 0) return ['No one else will sign on.'];
  state.silver -= n * SIGN_ON_GIFT;
  state.musterPool -= n;
  addRecruits(state, n);
  state.day += 5;
  learn(state, 'speech', 2);
  journal(state, `${plural(n, 'man', 'men')} signed on.`);
  return [`${plural(n, 'man', 'men')} take your sign-on gift and put their sea-chests aboard. ${formatSilver(n * SIGN_ON_GIFT)}.`];
}

export function provisionCost(state: GameState): { need: number; cost: number } {
  const need = Math.max(0, mouths(state) * PROVISION_DAYS - state.provisions);
  return { need, cost: Math.ceil(need / PROVISION_ORTUG_PER) };
}

export function provision(state: GameState): string[] {
  const { need, cost } = provisionCost(state);
  const pay = Math.min(cost, state.silver);
  const got = cost ? Math.round((need * pay) / cost) : 0;
  state.silver -= pay;
  state.provisions += got;
  state.day += 2;
  return [`Dried fish, barley, butter and ale: food for ${Math.floor(state.provisions / mouths(state))} days. ${formatSilver(pay)}.`];
}

export function refitCost(state: GameState): number {
  return state.ships.reduce((s, sh) => s + Math.ceil((100 - sh.hull) / 5), 0);
}

export function refit(state: GameState, content: ContentBundle): string[] {
  const cost = refitCost(state);
  if (cost > state.silver) return ['You cannot pay the shipwright.'];
  state.silver -= cost;
  for (const s of state.ships) s.hull = 100;
  state.day += 5;
  learn(state, 'craft', 2);
  void content;
  return [`New strakes, new rope, fresh tar. ${formatSilver(cost)}.`];
}

export function borrowShip(state: GameState): string[] {
  state.ships.push({ id: `ship${state.day}`, type: 'karvi', name: "The jarl's old karvi", hull: 70 });
  state.flags.owes_jarl = 1;
  state.day += 3;
  journal(state, 'Borrowed a karvi from the jarl, for a share of the summer.');
  return ['The jarl lends you his old karvi, for a quarter of what she brings home.'];
}

// ---- the autumn share-out ----

export type ShareHow = keyof typeof LEADER_SHARE;

/** Captives go to the traders before the shares are counted. */
/** At another man's oar, the share of the plunder that goes to the oars (the rest is the ship's and the captain's). */
export const SERVICE_OARS_SHARE = 0.75;
export const CAPTIVE_PRICE = 24; // about a mark a head (docs/ECONOMY.md)
function sellCaptives(state: GameState, lines: string[]): void {
  if (state.captives <= 0) return;
  const price = state.captives * CAPTIVE_PRICE;
  state.loot += price;
  lines.push(`A trader from Kaupang takes the ${plural(state.captives, 'captive')} off your hands for ${formatSilver(price)}. Nobody watches them go except Hallvard.`);
  journal(state, `Sold ${plural(state.captives, 'captive')} for ${formatSilver(price)}.`);
  state.captives = 0;
}

/** At another man's oar: the captain divides, and you take your shares. */
export function serviceShare(state: GameState, content: ContentBundle): string[] {
  const lines: string[] = [];
  sellCaptives(state, lines);
  const svc = state.service!;
  const pot = state.loot;
  const heads = state.crew.men + aliveMen(state).length + 1;
  const each = pot > 0 ? (pot * SERVICE_OARS_SHARE) / heads : 0; // a quarter to the ship and her captain, the rest to the oars
  const mine = Math.round(each * svc.shares);
  state.silver += mine;
  state.loot = 0;
  lines.push(pot > 0
    ? `${svc.captain} divides it on the strand in front of everyone: a quarter to the ship, the rest to the oars. Your ${svc.shares > 1 ? `${svc.shares} shares come` : 'share comes'} to ${formatSilver(mine)}.`
    : `${svc.captain} has nothing to divide but his thanks, and he is short of those too.`);
  journal(state, `Your share of the summer: ${formatSilver(mine)}.`);
  const { told, gained } = tellDeeds(state);
  if (told.length) lines.push(`At the homecoming feast the summer is told and retold: ${plural(told.length, 'deed')}, ${gained} fame.`);
  startWinter(state, HALL_ACTIONS);
  void content;
  return lines;
}

export function shareOut(state: GameState, content: ContentBundle, how: ShareHow): string[] {
  const lines: string[] = [];
  sellCaptives(state, lines);
  let pot = state.loot;
  if (state.flags.owes_jarl && pot > 0) {
    const cut = Math.round(pot * JARL_CUT);
    pot -= cut;
    lines.push(`The jarl's steward takes his quarter: ${formatSilver(cut)}.`);
  }
  const keep = Math.round(pot * LEADER_SHARE[how]);
  const heads = state.crew.men + aliveMen(state).length;
  const each = heads ? (pot - keep) / heads : 0;
  state.silver += keep;
  state.loot = 0;
  const ratio = each / SHARE_EXPECTED;
  state.crew.morale += Math.max(-3, Math.min(3, (ratio - 1) * 3)) + (how === 'generous' ? 1 : how === 'mean' ? -1 : 0);
  for (const m of aliveMen(state)) addLoyalty(m, how === 'generous' ? 1 : how === 'mean' ? -1 : 0);
  if (how === 'generous' && pot > 0) {
    state.honour = Math.min(10, state.honour + 1);
    addDeed(state, content, { type: 'open_handed', text: 'Shared the plunder with an open hand', witnesses: heads });
  }
  if (how === 'mean') state.honour = Math.max(-10, state.honour - 1);
  lines.push(pot > 0
    ? `You keep ${formatSilver(keep)}. Each man takes about ${formatSilver(each)}.`
    : 'There is nothing to share. The men go home with what they left with.');
  clampMorale(state);
  // the unhappy go home for good
  if (state.crew.morale < 4) {
    const leave = Math.round(state.crew.men * (4 - state.crew.morale) * 0.1);
    if (leave) {
      state.crew.men -= leave;
      lines.push(`${plural(leave, 'man', 'men')} will not sail with you again.`);
    }
  }
  for (const m of aliveMen(state)) {
    if (m.loyalty <= 1) {
      state.men = state.men.filter((x) => x !== m);
      lines.push(`${m.name} takes back his oath and goes to find another lord.`);
      journal(state, `${m.name} left your service.`);
    }
  }
  journal(state, `The share-out: you kept ${formatSilver(keep)}.`);
  // the homecoming feast tells the summer's deeds
  const { told, gained } = tellDeeds(state);
  if (told.length) lines.push(`At the homecoming feast the summer is told and retold: ${plural(told.length, 'deed')}, ${gained} fame.`);
  startWinter(state, HALL_ACTIONS);
  return lines;
}

// ---- the winter hall ----

export type HallWhat = 'feast' | 'gift' | 'train' | 'rest' | 'skald' | 'build' | 'blot' | 'buy_ship' | 'work';

export function feastCost(state: GameState): number {
  return mouths(state) + FEAST_GUESTS;
}

export const BUILD_TYPES = ['karvi', 'snekkja', 'skeid', 'knarr'] as const;

export function hallAction(state: GameState, content: ContentBundle, rng: RngCursor, what: HallWhat, arg?: string): string[] {
  const lines: string[] = [];
  switch (what) {
    case 'feast': {
      const cost = feastCost(state);
      state.silver -= cost;
      const { told, gained } = tellDeeds(state);
      state.crew.morale += 1;
      for (const m of aliveMen(state)) addLoyalty(m, 1);
      learn(state, 'speech', 2);
      lines.push(`You feast ${plural(mouths(state) + FEAST_GUESTS - 1, 'guest')} for three nights. ${formatSilver(cost)}.`);
      lines.push(told.length ? `Your deeds are told at the benches: ${plural(told.length, 'deed')}, ${gained} fame.` : 'There is nothing new to tell, so they tell the old ones again.');
      if (state.flags.skald && told.length) lines.push('Your skald has the hall laughing and then silent, in the right places.');
      break;
    }
    case 'gift': {
      const m = state.men.find((x) => x.id === arg && x.alive);
      if (!m) throw new Error(`no sworn man ${arg}`);
      state.silver -= ORTUG_PER_MARK;
      addLoyalty(m, 3);
      addDeed(state, content, { type: 'ring_giving', text: `Gave an arm-ring to ${m.name}`, witnesses: state.crew.men });
      lines.push(`You take an arm-ring from your own arm and put it on ${m.name}'s, in front of the hall.`);
      break;
    }
    case 'train': {
      const a = learn(state, 'weapons', 5);
      const b = learn(state, 'shield', 4);
      if (state.service) lines.push('Weeks of sword-play in the snow with Ketill and the others, behind your father\'s byre, until your arms are lead and your shins are black.');
      else {
        state.crew.quality = Math.min(2, state.crew.quality + 0.1);
        lines.push('Weeks of sword-play in the snow with the sworn men, and the crew drilled at the wall until they curse you.');
      }
      for (const l of [a, b]) if (l) lines.push(l);
      break;
    }
    case 'rest':
      heal(state, content, HALL_ACTION_DAYS, 1);
      lines.push('You sleep, eat, and let the wounds close.');
      break;
    case 'skald': {
      const d = composeVerse(state);
      lines.push(d ? `The skald makes a verse of it: ${d.text}. It will outlive you.` : 'The skald has nothing worth a verse yet. He says so.');
      break;
    }
    case 'build': {
      const type = content.ships[arg ?? ''];
      if (!type) throw new Error(`no ship type ${arg}`);
      state.silver -= type.cost;
      state.building = type.id;
      learn(state, 'craft', 4);
      lines.push(`The shipwrights fell the oaks and start laying the keel of a ${type.name.toLowerCase()}. ${formatSilver(type.cost)}. She will be ready in spring.`);
      break;
    }
    case 'buy_ship': {
      const cost = content.ships.karvi!.cost;
      state.silver -= cost;
      delete state.flags.owes_jarl;
      lines.push(`You pay the jarl ${formatSilver(cost)} for the karvi. She is yours, and so is everything she brings home.`);
      journal(state, 'Bought the karvi from the jarl.');
      break;
    }
    case 'work': {
      const pay = 5 + rng.int(4);
      state.silver += pay;
      learn(state, 'craft', 3);
      lines.push(`You work the winter on your brother's farm: mending, hauling, sharpening, mucking out. He pays you ${formatSilver(pay)} and you both pretend it is a gift.`);
      break;
    }
    case 'blot': {
      state.silver -= 12;
      state.hamingja = Math.min(5, state.hamingja + 1);
      learn(state, 'lore', 3);
      lines.push('A horse is killed at the hof, and the blood sprinkled on the posts and the people. The godi seems satisfied. Hallvard certainly is.');
      break;
    }
  }
  clampMorale(state);
  state.hallLeft -= 1;
  state.day += HALL_ACTION_DAYS;
  if (state.hallLeft <= 0) {
    const card = yearEnd(state, content, rng);
    // the spring card replaces the hall report, unless something else (a death, a scene) has the stage
    if (!state.pending && state.hero.alive) state.pending = { t: 'report', title: `Spring, ${dateOf(state.day).year}`, lines: [...lines, ...card], art: state.at === 'home_fjord' ? 'home_fjord' : undefined };
    return [];
  }
  trigger(state, content, rng, 'hall');
  return lines;
}

/** Wintering abroad: fewer choices, no feast at home. */
export function winterHere(state: GameState): string[] {
  startWinter(state, 2);
  return ['You haul the ships up and find a hall that will take you in for the winter, for a price in silver and good behaviour.'];
}

/** Winter begins. It belongs to the year whose autumn it follows; spring comes on 1 March after it. */
export function startWinter(state: GameState, actions: number): void {
  const d = dateOf(state.day);
  state.flags._winter = d.doy >= 182 ? d.year : d.year - 1;
  state.phase = 'winter';
  state.hallLeft = actions;
  if (d.doy >= 182) state.day = Math.max(state.day, nextDoy(state.day, WINTER_DOY));
}

// ---- the turn of the year ----

export function yearEnd(state: GameState, content: ContentBundle, rng: RngCursor): string[] {
  const lines: string[] = [];
  const winterOf = state.flags._winter ?? dateOf(state.day).year - 1;
  state.day = Math.max(state.day, dayOf(winterOf + 1, MUSTER_DOY));
  const year = dateOf(state.day).year;
  heal(state, content, 30, 1);
  if (strawDeathCheck(state, rng)) {
    kill(state, 'straw', `${state.hero.name} died in his bed in the winter of ${year - 1}, at ${age(state)}, of a fever that would not break.`);
    return lines;
  }
  for (const m of aliveMen(state)) addLoyalty(m, m.loyalty > 6 ? -1 : m.loyalty < 4 ? 1 : 0);
  for (const [id, ps] of Object.entries(state.places)) {
    const base = content.places[id]?.raid?.wealth ?? 0;
    ps.wealth = Math.min(base, Math.round(ps.wealth + base * 0.15));
    ps.defence = 1 + (ps.defence - 1) * 0.6;
  }
  // a winter hauled up: the men patch and tar what they can
  for (const sh of state.ships) sh.hull = Math.min(100, sh.hull + 15);
  // grudges fade, slowly; this year's hiring is spent
  driftStanding(state, content);
  if (state.building) {
    const t = content.ships[state.building]!;
    const name = SHIP_NAMES[(state.ships.length + state.stats.legs) % SHIP_NAMES.length]!;
    state.ships.push({ id: `ship${state.day}`, type: t.id, name, hull: 100 });
    lines.push(`The new ${t.name.toLowerCase()} is launched. You name her ${name}.`);
    journal(state, `Launched ${name}, a ${t.name.toLowerCase()}.`);
    state.building = null;
  }
  state.crew.morale = Math.round((state.crew.morale + 6) / 2);
  clampMorale(state);
  state.musterPool = 4 + Math.floor(livingFame(state) / 6) + 2 * effAttr(state, content, 'pre');
  state.seasonRaids = [];
  state.phase = state.at === 'home_fjord' ? 'muster' : 'sailing';
  lines.push(...chapterCard(state, content, year));
  journal(state, `Spring of ${year}.`);
  // spring's scenes open after the chapter card has been read (settle() triggers phase_start)
  return lines;
}

/** Where he stands at the turn of the year (Adalia's chapter cards). */
export function chapterCard(state: GameState, content: ContentBundle, year: number): string[] {
  const lines: string[] = [];
  const name = state.hero.nickname ? `${state.hero.name}, called ${state.hero.nickname}` : state.hero.name;
  lines.push(`${formatDate(state.day)}. ${name}, ${age(state)} winters old.`);
  const sworn = aliveMen(state).filter((m) => m.sworn);
  const bench = aliveMen(state).filter((m) => !m.sworn);
  if (state.service) lines.push(`An oarsman in ${state.service.captain}'s ship.`);
  else if (state.ships.length) lines.push(`Master of ${state.ships.map((s) => `${s.name} (${content.ships[s.type]?.name.toLowerCase()})`).join(', ')}, with ${plural(state.crew.men, 'man', 'men')} at the oars.`);
  else lines.push('No ship, and no bench in anyone else\'s.');
  if (sworn.length) lines.push(`Sworn to you: ${sworn.map((m) => m.nickname ? `${m.name} ${m.nickname}` : m.name).join(', ')}.`);
  if (bench.length) lines.push(`Bench-mates who have not sworn: ${bench.map((m) => m.name).join(', ')}.`);
  const dead = state.men.filter((m) => !m.alive && m.diedOn !== null && dateOf(m.diedOn).year >= year - 1);
  if (dead.length) lines.push(`Dead this year: ${dead.map((m) => m.name).join(', ')}.`);
  lines.push(`Silver: ${formatSilver(state.silver)}. Fame: ${Math.round(livingFame(state))}.`);
  const open = state.boasts.filter((b) => b.state === 'open');
  if (open.length) lines.push(`Sworn over the cup, and not yet done: ${open.map((b) => content.boasts[b.id]?.text).join(' ')}`);
  if (untoldCount(state)) lines.push('Some of last year\'s deeds were never told. They are already being forgotten.');
  return lines;
}
