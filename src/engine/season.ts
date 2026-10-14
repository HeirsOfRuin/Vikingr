// The year at home: spring muster, the autumn share-out and homecoming,
// the winter hall, and the turn of the year.
import { hirdLeaves, hirdRoom } from './hird';
import { hostageYear } from './hostages';
import { endFelag, FAVOUR, favourMuster, jarlCut, partnerCut, shiftFavour } from './allies';
import { rollTradeNews } from './trade';
import { addRings, giveRing, ringWords } from './rings';
import { ABLATE, earn, EXPECT_PER_FAME, give, payUpkeep, promiseMen, rollFire, rollHarvest, turnOfYear, dearthOf } from './hardship';
import { addShip, masterShares, MUSTER_PER_SHIP } from './fleet';
import type { ContentBundle } from '../content/schema';
import type { GameState } from './state';
import type { RngCursor } from './rng';
import { dateOf, dayOf, nextDoy, formatDate } from './calendar';
import { addDeed, composeVerse, livingFame, tellDeeds, untoldCount } from './fame';
import { addLoyalty, addRecruits, aliveMen, capacity, clampMorale, mouths, payShip, purse, SHIP_NAMES } from './crew';
import { effAttr, heal, learn, strawDeathCheck, kill, age } from './hero';
import { formatSilver, plural } from './format';
import { journal } from './journal';
import { trigger } from './director';
import { BASE, FARM_PRICE, feastMult, hallActionsFor, HALL_PRICE, hallPrice, takeWinterYield } from './base';
import { driftStanding } from './standing';
import {
  HALL_ACTIONS, HALL_ACTION_DAYS, LEADER_SHARE, MUSTER_DOY, ORTUG_PER_MARK, PROVISION_ORTUG_PER, SHARE_EXPECTED, SIGN_ON_GIFT, WINTER_DOY,
} from './tuning';

export const JARL_CUT = 0.25;
export const PROVISION_DAYS = 40;
export const FEAST_GUESTS = 10;
/** The benches a captain fills each spring when the hero rows for him. */
export const SERVICE_CREW = 26;
/** Man-days of food each man who signs on for a promise brings with him. */
export const PROMISE_FOOD = 20;

// ---- muster ----

function recruitSplit(state: GameState, content: ContentBundle): { paid: number; promised: number } {
  const room = Math.max(0, Math.min(state.musterPool, capacity(state, content) - state.crew.men - aliveMen(state).length));
  const paid = Math.min(room, Math.floor(purse(state) / SIGN_ON_GIFT));
  // the floor under a ruined man: some will row for the promise of a share (docs/FRAME-HARDSHIP.md)
  const promised = Math.min(room - paid, promiseMen(state));
  return { paid, promised };
}

export function recruitable(state: GameState, content: ContentBundle): number {
  const r = recruitSplit(state, content);
  return r.paid + r.promised;
}

export function recruit(state: GameState, content: ContentBundle): string[] {
  const { paid, promised } = recruitSplit(state, content);
  const n = paid + promised;
  if (n <= 0) return ['No one else will sign on.'];
  payShip(state, paid * SIGN_ON_GIFT);
  state.musterPool -= n;
  addRecruits(state, n);
  state.day += 5;
  learn(state, 'speech', 2);
  journal(state, `${plural(n, 'man', 'men')} signed on.`);
  const lines = paid ? [`${plural(paid, 'man', 'men')} take your sign-on gift and put their sea-chests aboard. ${formatSilver(paid * SIGN_ON_GIFT)}.`] : [];
  if (promised) {
    state.flags.promised = dateOf(state.day).year;
    // they bring their own sea-chests and a sack of meal each, as men answering a levy do
    state.provisions += promised * PROMISE_FOOD;
    state.crew.morale -= 1;
    clampMorale(state);
    lines.push(`${plural(promised, 'man', 'men')} sign on with nothing in hand but your word that the summer will pay. They're the ones nobody else would take, and they know it, and so do you.`);
  }
  return lines;
}

export function provisionCost(state: GameState): { need: number; cost: number } {
  const need = Math.max(0, mouths(state) * PROVISION_DAYS - state.provisions);
  // after a bad harvest, food is dear all spring
  const dear = dearthOf(state, dateOf(state.day).year - 1) ? 2 : 1;
  return { need, cost: Math.ceil((need * dear) / PROVISION_ORTUG_PER) };
}

export function provision(state: GameState): string[] {
  const { need, cost } = provisionCost(state);
  const pay = Math.min(cost, purse(state));
  const got = cost ? Math.round((need * pay) / cost) : 0;
  payShip(state, pay);
  state.provisions += got;
  state.day += 2;
  return [`Dried fish, barley, butter and ale: food for ${Math.floor(state.provisions / mouths(state))} days. ${formatSilver(pay)}.`];
}

export function refitCost(state: GameState): number {
  return state.ships.reduce((s, sh) => s + Math.ceil((100 - sh.hull) / 5), 0);
}

export function refit(state: GameState, content: ContentBundle): string[] {
  const cost = refitCost(state);
  if (cost > purse(state)) return ['You cannot pay the shipwright.'];
  payShip(state, cost);
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
export const CAPTIVE_PRICE = 24; // about half a pound a head (docs/ECONOMY.md)
function sellCaptives(state: GameState, lines: string[]): void {
  if (state.captives <= 0) return;
  const price = state.captives * CAPTIVE_PRICE;
  state.loot += price;
  lines.push(`A trader from Kaupang takes the ${plural(state.captives, 'captive')} off your hands for ${formatSilver(price)}. Nobody watches them go except Hallvard.`);
  journal(state, `Sold ${plural(state.captives, 'captive')} for ${formatSilver(price)}.`);
  state.captives = 0;
}

/** At another man's oar: the captain divides, and you take your shares. */
export function serviceShare(state: GameState, content: ContentBundle, rng?: RngCursor): string[] {
  const lines: string[] = [];
  sellCaptives(state, lines);
  const svc = state.service!;
  const pot = state.loot;
  const heads = state.crew.men + aliveMen(state).length + 1;
  const each = pot > 0 ? (pot * SERVICE_OARS_SHARE) / heads : 0; // a quarter to the ship and her captain, the rest to the oars
  const mine = Math.round(each * svc.shares);
  state.silver += mine;
  earn(state, mine);
  state.loot = 0;
  // a summer's extra shares are for that summer; the prow-man keeps his share and a half
  svc.shares = state.flags.prow_man ? 1.5 : 1;
  lines.push(pot > 0
    ? `${svc.captain} divides it on the strand in front of everyone: a quarter to the ship, the rest to the oars. Your ${svc.shares > 1 ? `${svc.shares} shares come` : 'share comes'} to ${formatSilver(mine)}.`
    : `${svc.captain} has nothing to divide but his thanks, and he is short of those too.`);
  journal(state, `Your share of the summer: ${formatSilver(mine)}.`);
  const { told, gained } = tellDeeds(state);
  if (told.length) lines.push(`At the homecoming feast the summer is told and retold: ${plural(told.length, 'deed')}, ${gained} fame.`);
  startWinter(state, hallActionsFor(state, HALL_ACTIONS), content, rng);
  return lines;
}

export function shareOut(state: GameState, content: ContentBundle, how: ShareHow, rng?: RngCursor): string[] {
  const lines: string[] = [];
  sellCaptives(state, lines);
  // the winter's keep comes off the top of the heap (docs/FRAME-HARDSHIP.md)
  lines.push(...payUpkeep(state, content));
  divideHeap(state, content, how, lines);
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
  // the homecoming feast tells the summer's deeds
  const { told, gained } = tellDeeds(state);
  if (told.length) lines.push(`At the homecoming feast the summer is told and retold: ${plural(told.length, 'deed')}, ${gained} fame.`);
  startWinter(state, hallActionsFor(state, HALL_ACTIONS), content, rng);
  return lines;
}

/** A share-out on a foreign strand, mid-summer, when the holds are full (playtest 4): the men carry their
 *  shares from here, and the summer goes on. */
export function divideAbroad(state: GameState, content: ContentBundle, how: ShareHow): string[] {
  const lines: string[] = [state.at === 'home_fjord' ? 'You divide the heap on the jarl\'s landing, in front of everyone, the way it\'s done.' : 'You divide the heap on the strand, in front of everyone, the way it\'s done.'];
  divideHeap(state, content, how, lines, true);
  return lines;
}

/** The dividing itself: a félag partner's part, the jarl's cut, his own share, the shipmasters', the men's. */
function divideHeap(state: GameState, content: ContentBundle, how: ShareHow, lines: string[], partial = false): void {
  let pot = state.loot;
  // a félag partner takes his men's part first (docs/FRAME-TRADE-ALLIES.md)
  const pc = partnerCut(state, content, pot, state.crew.men + aliveMen(state).length);
  if (pc.cut) { pot -= pc.cut; lines.push(pc.line!); }
  if ((state.flags.owes_jarl || state.flags.jarl_men === dateOf(state.day).year) && pot > 0) {
    const cut = Math.round(pot * jarlCut(state, JARL_CUT));
    pot -= cut;
    lines.push(`${state.flags.o_harek_ship ? "Harek's steward" : "The jarl's steward"} takes his quarter: ${formatSilver(cut)}.`);
  }
  const keep = Math.round(pot * LEADER_SHARE[how]);
  const heads = state.crew.men + aliveMen(state).length;
  // the shipmasters take their extra shares out of the men's part (docs/FRAME-FLEET.md)
  const ms = masterShares(state);
  const each = heads ? (pot - keep) / (heads + ms.shares) : 0;
  if (ms.shares && pot > 0) {
    lines.push(`The shipmasters take ${plural(ms.shares, 'extra share')}: ${formatSilver(each * ms.shares)}.`);
    for (const id of ms.sworn) { const m = state.men.find((x) => x.id === id); if (m) addLoyalty(m, 1); }
  }
  state.silver += keep;
  earn(state, keep);
  state.loot = 0;
  // a great captain's men expect a great captain's shares (docs/FRAME-HARDSHIP.md)
  const ratio = each / (SHARE_EXPECTED * (1 + (ABLATE.expect ? 0 : livingFame(state) * EXPECT_PER_FAME)));
  // a share in hand mid-summer only cheers them; the reckoning of the whole summer comes in autumn
  const mood = Math.max(-3, Math.min(3, (ratio - 1) * 3)) + (how === 'generous' ? 1 : how === 'mean' ? -1 : 0);
  state.crew.morale += partial ? Math.max(0, mood) : mood;
  for (const m of aliveMen(state)) addLoyalty(m, how === 'generous' ? 1 : how === 'mean' ? -1 : 0);
  if (how === 'generous' && pot > 0) {
    give(state, 'generous');
    state.honour = Math.min(10, state.honour + 1);
    addDeed(state, content, { type: 'open_handed', text: 'Shared the plunder with an open hand', witnesses: heads });
  }
  if (how === 'mean') state.honour = Math.max(-10, state.honour - 1);
  lines.push(pot > 0
    ? `You keep ${formatSilver(keep)}. Each man takes about ${formatSilver(each)}.`
    : 'There is nothing to share. The men go home with what they left with.');
  clampMorale(state);
  journal(state, `The share-out: you kept ${formatSilver(keep)}.`);
}

// ---- the winter hall ----

export type HallWhat = 'feast' | 'gift' | 'gift_gold' | 'train' | 'rest' | 'skald' | 'build' | 'blot' | 'buy_ship' | 'work' | 'buy_farm' | 'build_hall' | 'jarl_gift';

export function feastCost(state: GameState): number {
  return mouths(state) + FEAST_GUESTS;
}

export const BUILD_TYPES = ['karvi', 'snekkja', 'skeid', 'knarr'] as const;

/** What a man with no hall of his own does with a winter: his own family's work, by background. */
export function winterWork(state: GameState): { label: string; text: (pay: string) => string } | null {
  if (state.base.level !== 'father') return null;
  if (state.at === 'home_fjord') {
    if (state.hero.background === 'freedman') return { label: "Work in your father's boatyard", text: (pay) => `You work the winter in the boatyard with Leysingr: splitting oak along the grain, shaping strakes, clenching rivets, caulking the seams with tarred wool. A farmer from up the valley pays for a new færing, and your father counts you out ${pay} of it without a word, which from him is praise.` };
    if (state.hero.background === 'outlaw') return { label: "Work your father's farm", text: (pay) => `You work the winter on Grímr's farm: hauling, mending, mucking out. The neighbours nod to you at the hof and say what they think of you once your back is turned. Your father pays you ${pay} and says nothing about any of it.` };
    return { label: "Work your brother's farm", text: (pay) => `You work the winter on your brother's farm: mending, hauling, sharpening, mucking out. He pays you ${pay} and you both pretend it is a gift.` };
  }
  if (state.at === 'orkney' && state.flags.outlawed && !state.flags.outlaw_ended) return { label: "Work for Harek's steward", text: (pay) => `You work the winter for Harek's steward at Birsay: cutting peat, mending nets, standing to the thighs in the surf to drag the boats up the noust. He pays you ${pay}, an exile's wage, and makes sure you know it.` };
  return null;
}

export function hallAction(state: GameState, content: ContentBundle, rng: RngCursor, what: HallWhat, arg?: string): string[] {
  const lines: string[] = [];
  switch (what) {
    case 'feast': {
      const cost = feastCost(state);
      state.silver -= cost;
      const told0 = tellDeeds(state);
      // in his own hall, with trophies on the walls, the deeds are told better (FRAME-FOUNDATION §4)
      const fm = feastMult(state);
      // the hall tells a new deed better; an old one is an old one in any hall
      let extra = 0;
      if (fm > 1) for (const d of told0.fresh) { const w = Math.round(d.weight * fm * 10) / 10; extra += w - d.weight; d.weight = w; }
      const told = told0.told;
      const gained = Math.round((told0.gained + extra) * 10) / 10;
      if (fm > 1) lines.push(state.base.trophies.length ? `In your own hall, under ${plural(state.base.trophies.length, 'trophy', 'trophies')} on the wall, the telling goes better.` : 'In your own hall, the telling goes better.');
      state.crew.morale += 1;
      for (const m of aliveMen(state)) addLoyalty(m, 1);
      give(state, 'feast');
      learn(state, 'speech', 2);
      lines.push(`You feast ${plural(mouths(state) + FEAST_GUESTS - 1, 'guest')} for three nights. ${formatSilver(cost)}.`);
      lines.push(told.length ? `Your deeds are told at the benches: ${plural(told.length, 'deed')}, ${gained} fame.` : 'There is nothing new to tell, so they tell the old ones again.');
      if (state.flags.skald && told.length) lines.push('Your skald has the hall laughing and then silent, in the right places.');
      break;
    }
    case 'gift':
    case 'gift_gold': {
      const m = state.men.find((x) => x.id === arg && x.alive);
      if (!m) throw new Error(`no sworn man ${arg}`);
      lines.push(giveRing(state, content, m, what === 'gift_gold' ? 'gold' : 'silver'));
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
    case 'jarl_gift': {
      if (arg === 'gold') {
        // a gold ring is a gift a jarl remembers
        addRings(state, 'gold', -1);
        shiftFavour(state, FAVOUR.gift * 2);
        give(state, 'jarl');
        give(state, 'jarl');
        lines.push('You send the jarl a ring of twisted gold at midwinter, wrapped in a marten skin. He wears it at the Yule feast, on the arm he raises his horn with, and when he drinks to the district he looks down the hall at you.');
        journal(state, 'Sent the jarl a gold arm-ring.');
        break;
      }
      state.silver -= FAVOUR.giftCost;
      shiftFavour(state, FAVOUR.gift);
      give(state, 'jarl');
      lines.push(`You send the jarl a gift at midwinter: a cloak lined with marten, a silver cup, a good knife. ${formatSilver(FAVOUR.giftCost)}. It comes back with his thanks, and a seat nearer the high seat at the next feast.`);
      journal(state, 'Sent the jarl a gift.');
      break;
    }
    case 'buy_farm': {
      state.silver -= FARM_PRICE;
      state.base.level = 'farm';
      journal(state, 'Bought a farm of his own.');
      lines.push(`You buy the old Ketilsstead at the head of the fjord from a widow going to live with her daughter: a longhouse with a bad roof, a byre, a field, a strip of shore. ${formatSilver(FARM_PRICE)}.`, state.base.wife ? `${state.base.wife} walks round it twice, and says it will do, and starts on the roof.` : 'It is cold, and it is empty, and it is yours.');
      break;
    }
    case 'build_hall': {
      const rebuilt = !!state.flags.hall_burned;
      state.silver -= hallPrice(state);
      delete state.flags.hall_burned;
      state.base.level = 'hall';
      if (!rebuilt) addDeed(state, content, { type: 'deed', text: 'Built a hall of his own', weight: 5, witnesses: state.crew.men + 30 });
      journal(state, rebuilt ? 'Rebuilt the hall.' : 'Built a hall.');
      if (rebuilt) lines.push(`All winter the carpenters work on the burned posts, and raise the hall again on the old stones, carving the beasts back where they were. ${formatSilver(Math.round(HALL_PRICE / 2))}.`, 'It smells of new oak and old smoke. At the first feast in it, the hall is as full as it ever was.');
      else lines.push(`All winter the carpenters work on it: oak posts carved with beasts biting their own tails, a roof like an upturned ship, a high seat. ${formatSilver(HALL_PRICE)}.`, 'At the first feast in it, men you have never met come to the door and ask to be let in. They say your name at the door. That is what a hall is for.');
      break;
    }
    case 'work': {
      const pay = 5 + rng.int(4);
      state.silver += pay;
      learn(state, 'craft', 3);
      lines.push(winterWork(state)?.text(formatSilver(pay)) ?? `You work the winter for whoever will feed you, and are paid ${formatSilver(pay)}.`);
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
export function winterHere(state: GameState, content?: ContentBundle, rng?: RngCursor): string[] {
  startWinter(state, 2, content, rng);
  return ['You haul the ships up and find a hall that will take you in for the winter, for a price in silver and good behaviour.'];
}

/** Winter begins. It belongs to the year whose autumn it follows; spring comes on 1 March after it. */
export function startWinter(state: GameState, actions: number, content?: ContentBundle, rng?: RngCursor): void {
  const d = dateOf(state.day);
  state.flags._winter = d.doy >= 182 ? d.year : d.year - 1;
  state.phase = 'winter';
  state.hallLeft = actions;
  if (d.doy >= 182) state.day = Math.max(state.day, nextDoy(state.day, WINTER_DOY));
  // the harvest is in, or isn't; and a long dark winter of fires in a wooden house (docs/FRAME-HARDSHIP.md)
  if (content && rng && !state.service) {
    rollHarvest(state, content, rng, state.flags._winter);
    if (state.at === 'home_fjord') rollFire(state, content, rng);
  }
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
  // the winter's sickness and the winter's bills, and what the district thinks of him (docs/FRAME-HARDSHIP.md)
  const hardLines = turnOfYear(state, content, rng, year, state.at !== 'home_fjord');
  // new men whose loyalty has run out walk before the year's drift; the hostages eat, and their kin pay (docs/FRAME-HIRD-HOSTAGES.md)
  hardLines.push(...hirdLeaves(state), ...hostageYear(state, content, rng));
  // a sworn man fell last year: the oarsman who took his bench may ask to take his oath as well
  if (!state.service && hirdRoom(state) > 0 && state.men.some((m) => !m.alive && m.sworn && m.diedOn !== null && dateOf(m.diedOn).year >= year - 1)) state.queue.push({ scene: 'hi_heir', day: state.day });
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
    addShip(state, content, { type: t.id, name, hull: 100 });
    lines.push(`The new ${t.name.toLowerCase()} is launched. You name her ${name}.`);
    journal(state, `Launched ${name}, a ${t.name.toLowerCase()}.`);
    state.building = null;
  }
  // at another man's oar: the captain fills his empty benches from the muster, as every captain does
  if (state.service) state.crew.men = Math.max(state.crew.men, SERVICE_CREW);
  state.crew.morale = Math.round((state.crew.morale + 6) / 2);
  clampMorale(state);
  state.musterPool = 4 + Math.floor(livingFame(state) / 6) + 2 * effAttr(state, content, 'pre') + BASE[state.base.level].muster + MUSTER_PER_SHIP * Math.max(0, state.ships.length - 1) + favourMuster(state);
  state.musterPool = Math.max(0, state.musterPool);
  const felag = endFelag(state, content);
  if (felag) lines.push(felag);
  // the year's news on the trading beaches
  rollTradeNews(state, content, rng);
  // the farm's winter
  const y = takeWinterYield(state);
  if (y) lines.push(y);
  lines.push(...hardLines);
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
  const hs = state.hostages ?? [];
  if (hs.length) lines.push(`Hostages in your keeping: ${hs.map((h) => h.state === 'surety' ? `${h.who} (surety)` : h.who).join('; ')}.`);
  const dead = state.men.filter((m) => !m.alive && m.diedOn !== null && dateOf(m.diedOn).year >= year - 1);
  if (dead.length) lines.push(`Dead this year: ${dead.map((m) => m.name).join(', ')}.`);
  lines.push(`Silver: ${formatSilver(state.silver)}${state.base.hoard ? `, and ${formatSilver(state.base.hoard)} in the hoard` : ''}. Arm-rings: ${ringWords(state)}. Fame: ${Math.round(livingFame(state))}.`);
  const open = state.boasts.filter((b) => b.state === 'open');
  if (open.length) lines.push(`Sworn over the cup, and not yet done: ${open.map((b) => content.boasts[b.id]?.text).join(' ')}`);
  if (untoldCount(state)) lines.push('Some of last year\'s deeds were never told. They are already being forgotten.');
  return lines;
}
