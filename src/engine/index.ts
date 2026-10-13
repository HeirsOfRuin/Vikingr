// Engine facade. Three calls: newGame, view, act. Pure: act clones the state,
// works on the copy, and returns it. The UI, the bot and the tests all use this.
import type { ContentBundle, DuelMove, Order, Skill } from '../content/schema';
import { DUEL_MOVES, SKILLS } from '../content/schema';
import type { GameState, Pending, Position } from './state';
import { RngCursor, seedRng } from './rng';
import { dateOf, dayOf } from './calendar';
import { condPaths, test, unmetLabel } from './conditions';
import type { CondInput } from '../content/schema';
import { applyEffects } from './effects';
import { open, trigger } from './director';
import { hpMax, learn, effAttr } from './hero';
import { addRecruits, aliveMen, capacity, mouths, newMan, payShip, purse, SHIP_NAMES } from './crew';
import { appoint, buyHull, CARGO_UNIT, hullsForSale } from './fleet';
import { FAVOUR, favour, favourWord } from './allies';
import { buyLot, buyPrice, canBuy, sellLot, sellPrice, tradesHere } from './trade';
import { GUEST_DAYS, baseStanding, canHire, hireable, landingFoe, resupplyCost, RESUPPLY_DAYS, shiftStanding, standing, tierAt } from './standing';
import { adaptivePolicy as duelInstinct, canYield, fightOut, habitPolicy, MOVE_NAMES, resolveExchange } from './duel';
import { adaptivePolicy as battleAuto, availableOrders, doctrinePolicy, fightOutBattle, ORDER_NAMES, POSITION_NAMES, resolveRound } from './battle';
import { finishBattle, finishDuel, startBattle, startRaid } from './fights';
import { breakBoast, goalMet, keepBoast } from './boasts';
import { BASE, canBuildHall, FARM_PRICE, hangable, hangTrophy, HALL_PRICE, keepCaptives, newBase, thrallRoom } from './base';
import { armCost, buy, DEFAULT_KIT, equip, forSale, GEAR_MAX, gearWord, giveItem, type Shop, spareKit, sellValue, sellItem, giveKitTo, itemName } from './items';
import { expeditionRoads, routes, runVoyage, startVoyage } from './voyage';
import { expeditionBlock, listen, listenable, LISTEN_COST } from './discovery';
import {
  borrowShip, BUILD_TYPES, divideAbroad, feastCost, hallAction, provision, provisionCost, recruit, recruitable, refit, refitCost, serviceShare, shareOut, winterHere,
  type HallWhat, type ShareHow,
} from './season';
import { formatSilver, plural } from './format';
import { banter } from './banter';
import { plunderAction, ALARM_MAX, type PlunderWhat } from './plunder';
import { journal } from './journal';
import { renderText } from './text';
import { heal } from './hero';
import { SIGN_ON_GIFT, SERVICE_ROUTE, FORCE_RETURN_DOY, LATE_SEASON_DOY, MUSTER_DOY, ORTUG_PER_MARK, SAILING_DOY, START_YEAR, WINTER_DOY, BIRTH_YEAR } from './tuning';

export type Action =
  | { t: 'choose'; id: string }
  | { t: 'continue' }
  | { t: 'sail'; to: string }
  | { t: 'voyage_on' }
  | { t: 'raid' }
  | { t: 'forage' }
  | { t: 'resupply' }
  | { t: 'guest' }
  | { t: 'hire' }
  | { t: 'land' }
  | { t: 'listen' }
  | { t: 'hoard_in'; n?: number }
  | { t: 'hoard_out'; n?: number }
  | { t: 'hang'; item: string }
  | { t: 'keep_thralls' }
  | { t: 'shop' }
  | { t: 'buy'; item: string }
  | { t: 'arm' }
  | { t: 'equip'; uid: string }
  | { t: 'expedition'; to: string }
  | { t: 'rest' }
  | { t: 'end_season' }
  | { t: 'winter_here' }
  | { t: 'passage_home' }
  | { t: 'recruit' }
  | { t: 'provision' }
  | { t: 'refit' }
  | { t: 'borrow_ship' }
  | { t: 'set_sail' }
  | { t: 'stay_home' }
  | { t: 'share'; how: ShareHow }
  | { t: 'hall'; what: HallWhat; arg?: string }
  | { t: 'duel_move'; move: DuelMove }
  | { t: 'duel_auto' }
  | { t: 'yield' }
  | { t: 'order'; order: Order }
  | { t: 'position'; pos: Position }
  | { t: 'battle_auto' }
  | { t: 'slot'; man: string; slot: Position }
  | { t: 'buy_hull'; type: string }
  | { t: 'trade' }
  | { t: 'divide'; how: ShareHow }
  | { t: 'sell_item'; uid: string }
  | { t: 'give_item'; uid: string; man: string }
  | { t: 'trade_buy'; good: string }
  | { t: 'trade_sell'; good: string }
  | { t: 'appoint'; ship: string; man: string }
  | { t: 'follow' }
  | { t: 'take_share' }
  | { t: 'plunder'; what: PlunderWhat };

export interface ActionOption {
  action: Action;
  label: string;
  enabled: boolean;
  reason?: string;
  hint?: string;
  group: string;
}

export type Screen = 'scene' | 'report' | 'duel' | 'battle' | 'plunder' | 'shop' | 'trade' | 'voyage' | 'place' | 'muster' | 'return' | 'hall' | 'death';

export interface View {
  screen: Screen;
  actions: ActionOption[];
}

export class ActionError extends Error {}

export interface NewGameOptions {
  background: string;
  seed: number;
  name: string;
}

export function newGame(content: ContentBundle, opts: NewGameOptions): GameState {
  const bg = content.backgrounds[opts.background];
  if (!bg) throw new Error(`unknown background ${opts.background}`);
  const skills = Object.fromEntries(SKILLS.map((s) => [s, bg.skills[s] ?? 0])) as Record<Skill, number>;
  const xp = Object.fromEntries(SKILLS.map((s) => [s, 0])) as Record<Skill, number>;
  const state: GameState = {
    v: 1,
    seed: opts.seed,
    rng: seedRng(opts.seed),
    day: dayOf(START_YEAR, MUSTER_DOY),
    phase: 'muster',
    hallLeft: 0,
    hero: {
      name: `${opts.name.trim() || 'Hrafn'} ${bg.patronymic}`,
      background: bg.id,
      born: BIRTH_YEAR,
      attrs: { ...bg.attrs },
      skills,
      xp,
      hp: 0,
      wounds: [],
      nickname: null,
      alive: true,
    },
    honour: bg.honour,
    hamingja: 0,
    silver: bg.silver,
    loot: 0,
    provisions: 0,
    ships: [{ id: bg.service ? 'service' : 'borrowed', type: bg.ship, name: bg.service ? bg.service.ship_name : "The jarl's old karvi", hull: bg.service ? 90 : 80 }],
    crew: { men: bg.crew, quality: 0.6, morale: 6, gear: 0 },
    items: [],
    kit: {},
    base: newBase(),
    men: bg.men.map((id) => ({ ...newMan(content, id), sworn: !bg.service })),
    at: 'home_fjord',
    voyage: null,
    deeds: [],
    flags: Object.fromEntries((bg.flags ?? []).map((f) => [f, 1])),
    seen: {},
    queue: [],
    known: Object.values(content.places).filter((p) => p.known && p.active).map((p) => p.id),
    rumoured: [],
    places: Object.fromEntries(Object.values(content.places).map((p) => [p.id, { wealth: p.raid?.wealth ?? 0, defence: 1, raided: 0, lastRaided: null }])),
    pending: null,
    journal: [],
    death: null,
    stats: { legs: 0, storms: 0, battles: 0, battlesWon: 0, duels: 0, duelsWon: 0, raids: 0, plunder: 0, hungerDays: 0 },
    seasonRaids: [],
    building: null,
    musterPool: 0,
    position: 'wall',
    rearFights: 0,
    service: bg.service ? { captain: bg.service.captain, route: [], shares: 1 } : null,
    boasts: [],
    fates: {},
    omens: {},
    captives: 0,
  };
  // what will happen, and what the signs will say about it (DESIGN §12: omens right about seven times in ten)
  const fateRng = new RngCursor(seedRng(opts.seed ^ 0x2f6b9a1d));
  for (const f of Object.values(content.fates)) {
    state.fates[f.id] = fateRng.float() < f.chance ? 1 : 0;
    state.omens[f.id] = fateRng.float() < 0.7 ? state.fates[f.id]! : 1 - state.fates[f.id]!;
  }
  for (const id of bg.kit ?? DEFAULT_KIT) giveItem(state, content, id, true);
  state.hero.hp = hpMax(state, content);
  state.musterPool = 4 + 2 * effAttr(state, content, 'pre');
  // the first season's food comes from the farm and the jarl
  state.provisions = mouths(state) * 20;
  open(state, bg.start_scene);
  return state;
}

// ---- view ----

/** A choice that needs a sworn man who is dead is not offered at all: greyed out, it reads like a ghost. */
function needsTheDead(state: GameState, req: CondInput | undefined): boolean {
  if (!req) return false;
  return condPaths(req).some((p) => {
    const [ns, id] = p.split('.');
    return ns === 'man' && state.men.some((m) => m.id === id && !m.alive);
  });
}

const opt = (group: string, action: Action, label: string, enabled = true, reason?: string, hint?: string): ActionOption => ({ group, action, label, enabled, reason, hint });

export function screenOf(state: GameState): Screen {
  if (state.death) return 'death';
  const p = state.pending;
  if (p) return p.t;
  if (state.voyage) return 'voyage';
  if (state.phase === 'muster' && state.at === 'home_fjord') return 'muster';
  if (state.phase === 'return') return 'return';
  if (state.phase === 'winter') return 'hall';
  return 'place';
}

/** The smith, the market and the shipwright here, if any (FRAME-FOUNDATION §2). */
export function shopsHere(state: GameState, content: ContentBundle): Shop[] {
  const at = state.at;
  if (!at || state.voyage) return [];
  const p = content.places[at]!;
  if (p.kind === 'home') return ['smith', 'shipwright'];
  if (p.market) {
    const t = tierAt(state, content, at);
    return t === 'hostile' || t === 'unfriendly' ? [] : ['market', 'shipwright'];
  }
  return [];
}

function shopOption(state: GameState, content: ContentBundle): ActionOption[] {
  const shops = shopsHere(state, content);
  if (!shops.length) return [];
  const label = shops.includes('smith') ? 'Visit the smith and the shipwright' : 'Walk the market booths';
  const n = forSale(state, content, shops).length + (armCost(state) !== null && !state.service ? 1 : 0) + (shops.includes('shipwright') ? hullsForSale(state, content).length : 0) + spareKit(state, content).length;
  return [opt('Trade', { t: 'shop' }, label, n > 0, 'There is nothing here you need.', `${n} things worth looking at`)];
}

/** The trading beach, where the port has a market for goods (docs/FRAME-TRADE-ALLIES.md). */
function tradeOption(state: GameState, content: ContentBundle): ActionOption[] {
  if (!tradesHere(state, content)) return [];
  const p = content.places[state.at!]!;
  const makes = p.trade!.cheap.map((g) => content.goods[g]!.name.toLowerCase());
  return [opt('Trade', { t: 'trade' }, 'Trade goods on the beach', true, undefined, makes.length ? `They sell ${makes.join(', ')} cheap` : undefined)];
}

/** At home: the hoard, the wall (FRAME-FOUNDATION §4). Instant; shown on the Home tab and the home screens. */
export function baseActions(state: GameState, content: ContentBundle): ActionOption[] {
  if (state.at !== 'home_fjord' || state.voyage) return [];
  const out: ActionOption[] = [];
  // bury a mark, half, or all but a mark; dig up a mark, or the lot
  const MARK = ORTUG_PER_MARK;
  const spare = Math.max(0, state.silver - MARK);
  if (state.silver < MARK * 2) out.push(opt('Your base', { t: 'hoard_in' }, 'Bury silver in your hoard', false, 'You have nothing to spare.'));
  else {
    out.push(opt('Your base', { t: 'hoard_in', n: MARK }, 'Bury a mark in your hoard', true, undefined, formatSilver(MARK)));
    const half = Math.floor(state.silver / 2);
    if (half > MARK) out.push(opt('Your base', { t: 'hoard_in', n: half }, 'Bury half your silver', true, undefined, formatSilver(half)));
    if (spare > half) out.push(opt('Your base', { t: 'hoard_in', n: spare }, 'Bury all but a mark', true, undefined, formatSilver(spare)));
  }
  if (state.base.hoard > MARK) out.push(opt('Your base', { t: 'hoard_out', n: MARK }, 'Dig up a mark from your hoard', true, undefined, `${formatSilver(state.base.hoard)} buried`));
  out.push(opt('Your base', { t: 'hoard_out' }, 'Dig up the whole hoard', state.base.hoard > 0, 'The hoard is empty.', state.base.hoard > 0 ? formatSilver(state.base.hoard) : undefined));
  for (const id of hangable(state, content)) out.push(opt('Your base', { t: 'hang', item: id }, `Hang ${content.items[id]!.name.charAt(0).toLowerCase()}${content.items[id]!.name.slice(1)} on the wall`));
  return out;
}

function homeActions(state: GameState, content: ContentBundle): ActionOption[] {
  const out: ActionOption[] = [...shopOption(state, content), ...tradeOption(state, content), ...baseActions(state, content)];
  const n = recruitable(state, content);
  const room = capacity(state, content) - state.crew.men - aliveMen(state).length;
  out.push(opt('Muster', { t: 'recruit' }, n > 0 ? `Sign on ${plural(n, 'man', 'men')}` : 'Sign on men', n > 0,
    n > 0 ? undefined : room <= 0 ? 'Your ships are full.' : state.musterPool <= 0 ? 'No one else in the district will sign on this year.' : 'You cannot pay the sign-on gifts.',
    `${formatSilver(3)} each`));
  const pc = provisionCost(state);
  out.push(opt('Muster', { t: 'provision' }, 'Buy provisions', pc.need > 0 && purse(state) > 0,
    pc.need <= 0 ? 'The ships are provisioned.' : 'You have no silver, and nothing in the heap.', pc.need > 0 ? `${formatSilver(pc.cost)} for 40 days` : undefined));
  const rc = refitCost(state);
  if (state.ships.length) out.push(opt('Muster', { t: 'refit' }, 'Refit the ships', rc > 0 && purse(state) >= rc, rc <= 0 ? 'The ships are sound.' : `You need ${formatSilver(rc)}.`, rc > 0 ? formatSilver(rc) : undefined));
  if (!state.ships.length) out.push(opt('Muster', { t: 'borrow_ship' }, "Borrow a ship from the jarl", true, undefined, 'For a quarter of the plunder'));
  return out;
}

/** The captain's share-out choices. */
function listActionsReturn(state: GameState): ActionOption[] {
  const pot = state.loot;
  return [
    opt('Share-out', { t: 'share', how: 'generous' }, 'Share with an open hand', true, undefined, `Keep 15% of ${formatSilver(pot)}`),
    opt('Share-out', { t: 'share', how: 'fair' }, 'Share as custom has it', true, undefined, 'Keep 30%'),
    opt('Share-out', { t: 'share', how: 'mean' }, 'Keep the lord\'s share and more', true, undefined, 'Keep 50%'),
  ];
}

export function listActions(state: GameState, content: ContentBundle): ActionOption[] {
  const screen = screenOf(state);
  const p = state.pending;
  switch (screen) {
    case 'death': return [];
    case 'report': return [opt('', { t: 'continue' }, 'Continue')];
    case 'scene': {
      const scene = content.scenes[(p as { id: string }).id]!;
      return scene.choices
        .filter((c) => test(c.visible_if, state, content) && !needsTheDead(state, c.requires))
        .map((c) => {
          const ok = test(c.requires, state, content);
          return opt('', { t: 'choose', id: c.id }, renderText(c.text, state, content), ok, ok ? undefined : `Requires ${unmetLabel(c.requires!, state, content)}`, c.check ? checkBand(state, content, c.check) : undefined);
        });
    }
    case 'duel': {
      const d = (p as { duel: import('./state').DuelState }).duel;
      const out = DUEL_MOVES.map((m) => opt('Moves', { t: 'duel_move', move: m }, MOVE_NAMES[m]));
      out.push(opt('Other', { t: 'duel_auto' }, 'Let instinct take it'));
      if (canYield(d)) out.push(opt('Other', { t: 'yield' }, 'Step off the cloak and pay the holmlausn', true, undefined, '3 marks; honour falls'));
      return out;
    }
    case 'battle': {
      const b = (p as { battle: import('./state').BattleState }).battle;
      const ok = availableOrders(b, 'us');
      const out = ok.map((o) => opt(state.service ? 'Your shout' : 'Orders', { t: 'order', order: o }, ORDER_NAMES[o]));
      for (const pos of ['front', 'wall', 'rear'] as Position[]) if (pos !== b.position && !b.heroDown) out.push(opt('Your place', { t: 'position', pos }, `Move to: ${POSITION_NAMES[pos]}`));
      out.push(opt('Other', { t: 'battle_auto' }, 'Let the men handle it'));
      return out;
    }
    case 'voyage': return [opt('', { t: 'voyage_on' }, 'Sail on')];
    case 'muster': {
      if (state.service) {
        const svc = state.service;
        return [opt('Sail', { t: 'set_sail' }, `Row out with ${svc.captain}`, true, undefined, svc.route.length ? `Bound for ${content.places[svc.route[0]!]?.name ?? svc.route[0]}` : 'West, the way he went last year')];
      }
      const out = homeActions(state, content);
      const doy = dateOf(state.day).doy;
      const canSail = state.ships.length > 0 && state.crew.men >= 6;
      out.push(opt('Sail', { t: 'set_sail' }, doy < SAILING_DOY ? 'Put to sea early' : 'Put to sea', canSail, state.ships.length ? 'You need at least six men at the oars.' : 'You have no ship.', doy < SAILING_DOY ? 'The spring storms are not done' : undefined));
      out.push(opt('Sail', { t: 'stay_home' }, 'Stay home this summer', true, undefined, 'No plunder; the men grumble'));
      return out;
    }
    case 'return': {
      const room = thrallRoom(state);
      const thralls = state.captives > 0 && room > 0 && !state.service ? [opt('Captives', { t: 'keep_thralls' }, `Keep ${plural(Math.min(room, state.captives), 'captive')} as thralls at ${BASE[state.base.level].name.toLowerCase()}`, true, undefined, 'They work the land each winter; the rest go to the trader')] : [];
      if (state.service) return [opt('Share-out', { t: 'take_share' }, `Take your share from ${state.service.captain}`)];
      if (thralls.length) return [...thralls, ...listActionsReturn(state)];
      return listActionsReturn(state);
    }
    case 'hall': {
      const out: ActionOption[] = [];
      const home = state.at === 'home_fjord';
      const fc = feastCost(state);
      const lord = !state.service; // an oarsman eats at his father's table and does not hold feasts
      if (home) out.push(...shopOption(state, content), ...baseActions(state, content));
      if (home && state.base.level === 'father') out.push(opt('Your base', { t: 'hall', what: 'buy_farm' }, 'Buy a farm of your own', state.silver >= FARM_PRICE, `You need ${formatSilver(FARM_PRICE)}.`, formatSilver(FARM_PRICE)));
      if (home && state.base.level === 'farm') {
        const why = canBuildHall(state);
        out.push(opt('Your base', { t: 'hall', what: 'build_hall' }, 'Build a hall', !why, why ?? undefined, formatSilver(HALL_PRICE)));
      }
      if (lord || state.base.level !== 'father') out.push(opt('Hall', { t: 'hall', what: 'feast' }, 'Hold a feast', state.silver >= fc, `You need ${formatSilver(fc)}.`, formatSilver(fc)));
      else if (home) out.push(opt('Hall', { t: 'hall', what: 'work' }, "Work your brother's farm", true, undefined, 'A little silver; the winter passes'));
      for (const m of aliveMen(state)) out.push(opt('Gifts', { t: 'hall', what: 'gift', arg: m.id }, `Give ${m.name} an arm-ring`, state.silver >= ORTUG_PER_MARK, `You need ${formatSilver(ORTUG_PER_MARK)}.`, `Loyalty ${m.loyalty}/10`));
      out.push(opt('Hall', { t: 'hall', what: 'train' }, lord ? 'Train with the men' : 'Practise with your bench-mates'));
      out.push(opt('Hall', { t: 'hall', what: 'rest' }, 'Rest and heal'));
      if (state.flags.skald) out.push(opt('Hall', { t: 'hall', what: 'skald' }, 'Have the skald compose'));
      if (home && !state.service) out.push(opt('The jarl', { t: 'hall', what: 'jarl_gift' }, 'Send the jarl a gift', state.silver >= FAVOUR.giftCost, `You need ${formatSilver(FAVOUR.giftCost)}.`, `${formatSilver(FAVOUR.giftCost)}; his favour: ${favourWord(favour(state))}`));
      if (home) out.push(opt('Hall', { t: 'hall', what: 'blot' }, 'Hold a blót', state.silver >= 12, `You need ${formatSilver(12)}.`, formatSilver(12)));
      if (home && lord && !state.building) for (const t of BUILD_TYPES) {
        const st = content.ships[t]!;
        out.push(opt('Ships', { t: 'hall', what: 'build', arg: t }, `Build a ${st.name.toLowerCase()}`, state.silver >= st.cost, `You need ${formatSilver(st.cost)}.`, formatSilver(st.cost)));
      }
      if (home && lord && state.flags.owes_jarl && state.ships.length) {
        const c = content.ships.karvi!.cost;
        out.push(opt('Ships', { t: 'hall', what: 'buy_ship' }, "Buy the karvi from the jarl", state.silver >= c, `You need ${formatSilver(c)}.`, formatSilver(c)));
      }
      return out;
    }
    case 'shop': {
      const shops = (p as { shops: Shop[] }).shops;
      const out = forSale(state, content, shops).map((d) => opt(d.kind === 'fitting' ? 'The shipwright' : shops.includes('smith') ? 'The smith' : 'The booths', { t: 'buy', item: d.id }, `Buy ${d.name.charAt(0).toLowerCase()}${d.name.slice(1)}`, state.silver >= d.price!, `You need ${formatSilver(d.price!)}.`, formatSilver(d.price!)));
      const ac = armCost(state);
      if (ac !== null && !state.service) out.push(opt('Your men', { t: 'arm' }, `Arm the men: ${gearWord(Math.floor(state.crew.gear) + 1)}`, state.silver >= ac, `You need ${formatSilver(ac)}.`, `${formatSilver(ac)} for ${state.crew.men} men`));
      // kit he no longer carries, to the smith or the booths (playtest 4)
      for (const x of spareKit(state, content)) {
        const n = itemName(content, x);
        out.push(opt('Sell', { t: 'sell_item', uid: x.uid }, `Sell ${n.charAt(0).toLowerCase()}${n.slice(1)}`, true, undefined, `${formatSilver(sellValue(content, x))}${content.items[x.id]?.heirloom ? '; it was never yours to sell, men will say' : ''}`));
      }
      // secondhand hulls on a market beach (docs/FRAME-FLEET.md)
      if (shops.includes('shipwright')) for (const h of hullsForSale(state, content)) {
        const st = content.ships[h.type]!;
        out.push(opt('Ships', { t: 'buy_hull', type: h.type }, `Buy a secondhand ${st.name.toLowerCase()}`, state.silver >= h.price, `You need ${formatSilver(h.price)}.`, `${formatSilver(h.price)}; ${st.crew} men, carries ${formatSilver((st.cargo ?? 1) * CARGO_UNIT)}`));
      }
      out.push(opt('', { t: 'continue' }, 'Done'));
      return out;
    }
    case 'trade': {
      const at = state.at!;
      const t = content.places[at]!.trade!;
      const out: ActionOption[] = [];
      for (const [g, c] of Object.entries(state.cargo ?? {})) {
        const sp = sellPrice(state, content, at, g);
        const basis = Math.round(c.cost / Math.max(1, c.lots));
        out.push(opt('Sell', { t: 'trade_sell', good: g }, `Sell ${content.goods[g]!.lot}`, true, undefined, `${formatSilver(sp)} here; you paid ${formatSilver(basis)} (${c.lots} aboard)`));
      }
      const news = state.tradeNews?.year === dateOf(state.day).year ? state.tradeNews.good : null;
      const buyable = [...new Set([...t.cheap, ...(news && state.tradeNews!.mult < 1 ? [news] : [])])];
      for (const g of buyable) {
        const why = canBuy(state, content, at, g);
        out.push(opt('Buy', { t: 'trade_buy', good: g }, `Buy ${content.goods[g]!.lot}`, !why, why ?? undefined, `${formatSilver(buyPrice(state, content, at, g))}; ${content.goods[g]!.bulk} of hold space`));
      }
      out.push(opt('', { t: 'continue' }, 'Done'));
      return out;
    }
    case 'plunder': {
      const pl = (p as { plunder: import('./state').PlunderState }).plunder;
      const left = ALARM_MAX - pl.alarm;
      const warn = left <= 3 ? 'The alarm is close to spreading' : undefined;
      return [
        opt('Plunder', { t: 'plunder', what: 'grab' }, 'Strip the next house', true, undefined, warn ?? 'More silver; more noise'),
        opt('Plunder', { t: 'plunder', what: 'captives' }, 'Take captives for the slave markets', true, undefined, 'Worth silver in Kaupang; slow and loud'),
        opt('Plunder', { t: 'plunder', what: 'burn' }, 'Burn it', !pl.burned, 'It is already burning.', 'Talked about for years; seen for miles'),
        state.service
          ? opt('Plunder', { t: 'plunder', what: 'leave' }, `Head for the ships before ${state.service.captain} blows the horn`, true, undefined, `Carrying ${formatSilver(pl.taken)}`)
          : opt('Plunder', { t: 'plunder', what: 'leave' }, 'Back to the ships, now', true, undefined, `Carrying ${formatSilver(pl.taken)}`),
      ];
    }
    case 'place': {
      const out: ActionOption[] = [];
      const at = state.at!;
      const place = content.places[at]!;
      const doy = dateOf(state.day).doy;
      if (state.service) {
        const svc = state.service;
        const dest = svc.route[0];
        if (dest && dest !== at) out.push(opt('Sail', { t: 'follow' }, `Row on with ${svc.captain}`, true, undefined, `Bound for ${content.places[dest]?.name ?? dest}`));
        else if (at !== 'home_fjord') out.push(opt('Sail', { t: 'follow' }, `Row home with ${svc.captain}`, true, undefined, `Bound for ${content.places.home_fjord!.name}`));
        else out.push(opt('Season', { t: 'end_season' }, 'Haul up the ship for the winter'));
        return out;
      }
      if (state.ships.length) {
        for (const r of routes(state, content, at)) {
          const short = state.provisions < mouths(state) * r.days;
          out.push(opt('Sail', { t: 'sail', to: r.to }, `Sail to ${content.places[r.to]!.name}`, true, undefined, `About ${r.days} days, ${r.leg.kind === 'open' ? 'open sea' : r.leg.kind}${short ? '. Not enough food' : ''}`));
        }
      } else if (at !== 'home_fjord') out.push(opt('Sail', { t: 'passage_home' }, state.silver >= 12 ? 'Take passage home on a trader' : 'Work your passage home on a trader', true, undefined, state.silver >= 12 ? formatSilver(12) : 'No silver: a month at another man\'s oar'));
      if (place.raid) {
        const done = state.seasonRaids.includes(at);
        out.push(opt('Here', { t: 'raid' }, `Raid ${place.name}`, !done && state.crew.men >= 6, done ? 'You raided it this summer already.' : 'You have too few men.'));
      }
      // what this port will do for him depends on what it thinks of him (DESIGN §11.6)
      const tier = tierAt(state, content, at);
      if (at !== 'home_fjord') {
        if (tier === 'hostile') {
          const lf = landingFoe(content, at);
          out.push(opt('Here', { t: 'land' }, 'Fight your way ashore for water and cattle', state.crew.men >= 6, 'You have too few men.', `They will meet you on the beach: about ${lf.men} of them`));
        } else {
          const rc = resupplyCost(state, content, at);
          if (rc) out.push(opt('Here', { t: 'resupply' }, 'Buy food from the locals', rc.need > 0 && purse(state) > 0, rc.need <= 0 ? 'The ships are provisioned.' : 'You have no silver, and nothing in the heap.', rc.need > 0 ? `${formatSilver(rc.cost)} for ${RESUPPLY_DAYS} days${tier === 'wary' ? ', at a wary price' : tier === 'allied' ? ', at a friend\'s price' : ''}` : undefined));
          if (content.places[at]!.market) out.push(...shopOption(state, content));
          out.push(...tradeOption(state, content));
          const year = dateOf(state.day).year;
          if (GUEST_DAYS[tier] > 0) out.push(opt('Here', { t: 'guest' }, 'Ask for guest-right', state.places[at]?.guested !== year, 'You have had their hospitality this year.', `Food for ${GUEST_DAYS[tier]} days, free, once a year`));
          const hire = hireable(state, content, at);
          if (canHire(state, content, at) > 0) out.push(opt('Here', { t: 'hire' }, hire > 0 ? `Hire ${plural(hire, 'man', 'men')} here` : 'Hire men here', hire > 0, 'No benches free, or no silver for the gift.', `${formatSilver(hire * SIGN_ON_GIFT)}`));
          out.push(opt('Here', { t: 'forage' }, 'Take cattle and water from the shore', true, undefined, tier === 'unfriendly' ? 'They will likely fight for them; and they will remember' : 'Food for the crew; the locals will remember'));
        }
      }
      // share out on the strand, when the holds are full and the summer isn't (playtest 4)
      if (!state.service && state.loot > 0) {
        out.push(opt('Plunder', { t: 'divide', how: 'fair' }, 'Share out the plunder here', true, undefined, `${formatSilver(state.loot)} in the heap; fair shares, and room in the holds again`));
        out.push(opt('Plunder', { t: 'divide', how: 'generous' }, 'Share it out with an open hand', true, undefined, 'Less for you; the men remember'));
      }
      if (tier !== 'hostile') out.push(opt('Here', { t: 'rest' }, 'Rest a few days'));
      // rumours of far places, and expeditions to them (FRAME-FOUNDATION §1)
      if (tier !== 'hostile' && listenable(state, content, at)) out.push(opt('Here', { t: 'listen' }, 'Stand the old sailors a round, and listen', state.silver >= LISTEN_COST, `You need ${formatSilver(LISTEN_COST)} for the ale.`, `${formatSilver(LISTEN_COST)}; a day; rumours of far places`));
      if (state.ships.length) for (const r of expeditionRoads(state, content, at)) {
        const why = expeditionBlock(state, content);
        out.push(opt('Sail', { t: 'expedition', to: r.to }, `Mount an expedition to ${content.places[r.to]!.name}`, !why, why ?? undefined, `Uncharted water: about ${r.days} days, maybe more`));
      }
      if (at === 'home_fjord') {
        out.push(...homeActions(state, content));
        out.push(opt('Season', { t: 'end_season' }, 'Haul up the ships for the winter', doy >= LATE_SEASON_DOY, 'Too early: the summer is not done.'));
      } else if (doy >= WINTER_DOY || doy < MUSTER_DOY) out.push(opt('Season', { t: 'winter_here' }, `Winter at ${place.name}`, tier !== 'hostile' && tier !== 'unfriendly', 'Nobody here will give you a roof.'));
      return out;
    }
  }
}

function checkBand(state: GameState, content: ContentBundle, c: { skill: Skill; attr: import('../content/schema').Attr; difficulty: number }): string {
  const p = checkChance(state, content, c);
  return p < 0.4 ? 'Risky' : p <= 0.65 ? 'Even' : 'Favourable';
}

export function checkChance(state: GameState, content: ContentBundle, c: { skill: Skill; attr: import('../content/schema').Attr; difficulty: number }): number {
  return Math.min(0.95, Math.max(0.05, 0.5 + 0.1 * (effAttr(state, content, c.attr) + state.hero.skills[c.skill] - c.difficulty)));
}

export function view(content: ContentBundle, state: GameState): View {
  return { screen: screenOf(state), actions: listActions(state, content) };
}

// ---- act ----

function sameAction(a: Action, b: Action): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function act(content: ContentBundle, input: GameState, action: Action): GameState {
  const allowed = listActions(input, content).find((o) => sameAction(o.action, action));
  if (action.t !== 'slot' && action.t !== 'equip' && action.t !== 'appoint' && action.t !== 'give_item' && (!allowed || !allowed.enabled)) throw new ActionError(`not available now: ${JSON.stringify(action)}${allowed?.reason ? ' — ' + allowed.reason : ''}`);
  const state = structuredClone(input);
  const rng = new RngCursor(state.rng);
  const report = (title: string, lines: string[], next?: string, art?: { key: string; laughter?: string }) => {
    if (!state.pending && lines.length) state.pending = { t: 'report', title, lines, next, art: art?.key, laughter: art?.laughter };
  };

  switch (action.t) {
    case 'continue': {
      const next = state.pending?.t === 'report' ? state.pending.next : undefined;
      state.pending = null;
      delete state.shopNote;
      if (next) open(state, next);
      break;
    }
    case 'choose': {
      const p = state.pending as { t: 'scene'; id: string };
      const scene = content.scenes[p.id]!;
      const c = scene.choices.find((x) => x.id === action.id)!;
      state.pending = null;
      applyEffects(state, content, rng, c.effects);
      let text = c.result;
      let next = c.next;
      if (c.check) {
        const ok = rng.float() < checkChance(state, content, c.check);
        learn(state, c.check.skill, ok ? 2 : 3);
        const o = ok ? c.success : c.failure;
        if (o) {
          applyEffects(state, content, rng, o.effects);
          text = o.text ?? text;
          next = o.next ?? next;
        }
      }
      if (text) text = renderText(text, state, content, { keepDead: scene.id.startsWith('mourn_') });
      const pd = state.pending as Pending | null;
      if (pd) {
        if (text && pd.t === 'duel') pd.duel.log.unshift(text);
        if (text && pd.t === 'battle') pd.battle.log.unshift(text);
      } else if (text) report(scene.title, text.trim().split(/\n\s*\n/), next, typeof scene.art === 'string' ? { key: scene.art } : scene.art);
      else if (next) open(state, next);
      break;
    }
    case 'sail':
    case 'follow':
    case 'voyage_on': {
      if (action.t === 'sail') startVoyage(state, content, action.to);
      if (action.t === 'follow') startVoyage(state, content, state.service?.route[0] ?? 'home_fjord', true);
      const r = runVoyage(state, content, rng);
      const talk = banter(state, content, rng, 'sea', 0.6);
      if (talk) r.lines.push(talk);
      report('At sea', r.lines, undefined, { key: 'open_sea' });
      break;
    }
    case 'take_share': report('The share-out', serviceShare(state, content)); break;
    case 'plunder':
      plunderAction(state, content, rng, action.what);
      break;
    case 'raid':
      startRaid(state, content, rng, state.at!);
      break;
    case 'resupply': {
      const rc = resupplyCost(state, content, state.at!)!;
      // the ship's stores are bought out of the heap, as any captain's would; then out of his own silver
      const pay = Math.min(rc.cost, purse(state));
      const got = rc.cost ? Math.round((rc.need * pay) / rc.cost) : 0;
      payShip(state, pay);
      state.provisions += got;
      state.day += 1;
      // a paying customer is remembered kindly, up to a point
      if (standing(state, content, state.at!) < baseStanding(content, state.at!) + 3) shiftStanding(state, content, state.at!, 1);
      report('Trading', [`You buy dried fish, meal, cheese and a cask of sour ale: food for ${Math.floor(state.provisions / mouths(state))} days. ${formatSilver(pay)}.`]);
      break;
    }
    case 'shop':
      state.pending = { t: 'shop', shops: shopsHere(state, content) };
      break;
    case 'trade':
      state.pending = { t: 'trade' };
      break;
    case 'sell_item':
      state.shopNote = sellItem(state, content, action.uid);
      state.pending = { t: 'shop', shops: (state.pending as { shops: Shop[] }).shops };
      break;
    case 'give_item': {
      const line = giveKitTo(state, content, action.uid, action.man);
      if (line) journal(state, line);
      break;
    }
    case 'divide':
      report('The share-out', divideAbroad(state, content, action.how));
      break;
    case 'trade_buy':
      state.shopNote = buyLot(state, content, state.at!, action.good);
      state.pending = { t: 'trade' };
      break;
    case 'trade_sell':
      state.shopNote = sellLot(state, content, state.at!, action.good);
      learn(state, 'trade', 1);
      state.pending = { t: 'trade' };
      break;
    case 'buy_hull': {
      const name = SHIP_NAMES[(state.ships.length * 3 + state.day) % SHIP_NAMES.length]!;
      const line = buyHull(state, content, action.type, state.ships.some((s) => s.name === name) ? `${name} the Second` : name);
      state.pending = { t: 'shop', shops: (state.pending as { shops: Shop[] }).shops };
      state.shopNote = line;
      break;
    }
    case 'appoint':
      if (!state.voyage && !state.service) appoint(state, content, action.ship, action.man);
      break;
    case 'buy': {
      const lines = buy(state, content, action.item);
      state.pending = { t: 'shop', shops: (state.pending as { shops: Shop[] }).shops };
      state.shopNote = lines.join(' ');
      break;
    }
    case 'arm': {
      const cost = armCost(state)!;
      state.silver -= cost;
      state.crew.gear = Math.min(GEAR_MAX, Math.floor(state.crew.gear) + 1);
      journal(state, `Armed the men: ${gearWord(state.crew.gear)}.`);
      state.shopNote = `You buy ${gearWord(state.crew.gear)} for ${state.crew.men} men. They look like a ship's crew now, and not a farm's.`;
      break;
    }
    case 'equip':
      equip(state, content, action.uid);
      break;
    case 'hoard_in': {
      const n = Math.max(0, Math.min(state.silver, action.n ?? state.silver - ORTUG_PER_MARK));
      state.silver -= n;
      state.base.hoard += n;
      journal(state, `Buried ${formatSilver(n)} in the hoard.`);
      break;
    }
    case 'hoard_out': {
      const n = Math.min(state.base.hoard, action.n ?? state.base.hoard);
      state.silver += n;
      state.base.hoard -= n;
      journal(state, `Dug up ${formatSilver(n)} from the hoard.`);
      break;
    }
    case 'hang':
      hangTrophy(state, content, action.item);
      break;
    case 'keep_thralls': {
      const n = keepCaptives(state);
      report('Thralls', [`${plural(n, 'captive')} ${n === 1 ? 'goes' : 'go'} up the hill to ${BASE[state.base.level].name.toLowerCase()}, to cut turf and carry water and muck out the byre. ${state.base.wife ? `${state.base.wife} looks them over the way she looks at a new cow.` : 'Your mother looks at them a long time, and does not say what she thinks.'}`]);
      break;
    }
    case 'listen': {
      state.silver -= LISTEN_COST;
      state.day += 1;
      report('Old sailors', listen(state, content, rng, state.at!));
      break;
    }
    case 'expedition': {
      startVoyage(state, content, action.to, false, true);
      journal(state, `Set out on an expedition to ${content.places[action.to]!.name}.`);
      const r = runVoyage(state, content, rng);
      report('Uncharted water', ['The last land you know goes down behind you. After that there is only the sea, and what the old men said.', ...r.lines], undefined, { key: 'open_sea' });
      break;
    }
    case 'guest': {
      const days = GUEST_DAYS[tierAt(state, content, state.at!)];
      state.provisions += mouths(state) * days;
      state.places[state.at!]!.guested = dateOf(state.day).year;
      state.day += 1;
      report('Guest-right', [`They take you up to the hall and feed your men, and put food in the ships for ${plural(days, 'day')}, and will not hear of silver. Next time, they will expect you to remember it.`]);
      break;
    }
    case 'hire': {
      const n = hireable(state, content, state.at!);
      payShip(state, n * SIGN_ON_GIFT);
      addRecruits(state, n);
      const ps = state.places[state.at!]!;
      ps.hired = (ps.hired ?? 0) + n;
      state.day += 1;
      journal(state, `${plural(n, 'man', 'men')} signed on at ${content.places[state.at!]!.name}.`);
      report('Hiring', [`${plural(n, 'young man', 'young men')} come down to the shore with sea-chests on their shoulders and take your sign-on gift. ${formatSilver(n * SIGN_ON_GIFT)}.`]);
      break;
    }
    case 'land': {
      const lf = landingFoe(content, state.at!);
      state.day += 1;
      shiftStanding(state, content, state.at!, -1);
      startBattle(state, content, { foe: lf.foe, men: lf.men, terrain: 'beach', context: 'scene', place: state.at });
      if (state.pending?.t === 'battle') {
        state.pending.battle.log.unshift('They have seen your sail, and they know whose it is. They are on the beach before your keel is.');
        state.provisions += mouths(state) * 10; // whatever happens on the beach, the water-casks get filled
      }
      break;
    }
    case 'forage': {
      state.day += 2;
      const fightChance = { hostile: 1, unfriendly: 0.55, wary: 0.3, friendly: 0.15, allied: 0.1 }[tierAt(state, content, state.at!)];
      shiftStanding(state, content, state.at!, -2);
      if (rng.float() < fightChance) {
        startBattle(state, content, { foe: 'island_men', men: 6 + rng.int(14), terrain: 'field', context: 'scene', place: state.at });
        if (state.pending?.t === 'battle') state.pending.battle.log.unshift('The cattle have owners, and the owners have spears.');
      } else {
        const got = mouths(state) * (6 + rng.int(6));
        state.provisions += got;
        report('Strandhögg', [`You come back down to the ships driving cattle and carrying cheeses: food for ${Math.floor(got / mouths(state))} days.`]);
      }
      break;
    }
    case 'rest':
      state.day += 3;
      heal(state, content, 3, 0.8);
      state.provisions = Math.max(0, state.provisions - mouths(state) * (state.at === 'home_fjord' ? 0 : 3));
      break;
    case 'end_season':
      // another man's ship comes home when he says; the captain keeps her out until the autumn
      if (state.service) state.day = Math.max(state.day, dayOf(dateOf(state.day).year, LATE_SEASON_DOY));
      state.phase = 'return';
      break;
    case 'winter_here':
      report('Winter abroad', winterHere(state));
      break;
    case 'passage_home': {
      const paid = state.silver >= 12;
      if (paid) state.silver -= 12;
      state.day += paid ? 12 : 30;
      state.at = 'home_fjord';
      report('Home', [paid ? 'A trader takes you home for silver and a hand at the oars.' : 'A trader takes you home for nothing but your back at his oars, by the longest way round, with a stop at every market between.']);
      break;
    }
    case 'recruit': report('Muster', recruit(state, content)); break;
    case 'provision': report('Muster', provision(state)); break;
    case 'refit': report('Muster', refit(state, content)); break;
    case 'borrow_ship': report('Muster', borrowShip(state)); break;
    case 'set_sail':
      // the captain waits for the spring storms to blow out
      if (state.service) {
        state.day = Math.max(state.day, dayOf(dateOf(state.day).year, SAILING_DOY));
        // a captain with nothing new in mind goes west the way he went last year (Phase 3 writes his choices)
        if (!state.service.route.length) state.service.route = [...SERVICE_ROUTE];
      }
      state.phase = 'sailing';
      break;
    case 'stay_home':
      state.crew.morale = Math.max(0, state.crew.morale - 1);
      state.day = dayOf(dateOf(state.day).year, LATE_SEASON_DOY + 30);
      heal(state, content, 120, 1);
      state.phase = 'return';
      break;
    case 'share': report('The share-out', shareOut(state, content, action.how)); break;
    case 'hall': report('The hall', hallAction(state, content, rng, action.what, action.arg)); break;
    case 'duel_move':
    case 'duel_auto':
    case 'yield': {
      const d = (state.pending as { t: 'duel'; duel: import('./state').DuelState }).duel;
      if (action.t === 'yield') d.over = 'yielded';
      else if (action.t === 'duel_auto') fightOut(d, duelInstinct, rng, true);
      else resolveExchange(d, action.move, habitPolicy(d, 'foe', rng), rng);
      if (d.over) finishDuel(state, content, rng, d);
      break;
    }
    case 'order':
    case 'battle_auto':
    case 'position': {
      const b = (state.pending as { t: 'battle'; battle: import('./state').BattleState }).battle;
      if (action.t === 'position') {
        b.position = action.pos;
        state.position = action.pos;
        b.log.push(`You take your place: ${POSITION_NAMES[action.pos].toLowerCase()}.`);
      } else if (action.t === 'battle_auto') fightOutBattle(b, battleAuto, rng);
      else resolveRound(b, action.order, doctrinePolicy(b, 'them', rng), rng);
      if (b.over) finishBattle(state, content, rng, b);
      break;
    }
    case 'slot': {
      const m = state.men.find((x) => x.id === action.man);
      if (m) m.slot = action.slot;
      break;
    }
  }

  settle(state, content, rng);
  state.rng = rng.state;
  return state;
}

/** After any action: boasts fall due, the season turns if it must, and anything queued fires. */
function settle(state: GameState, content: ContentBundle, rng: RngCursor): void {
  if (!state.hero.alive || state.pending) return;
  for (const b of state.boasts) {
    if (!goalMet(state, content, b)) continue;
    keepBoast(state, content, b);
    state.pending = { t: 'report', title: 'A boast kept', lines: [`You swore it over the cup: ${content.boasts[b.id]?.text}`, 'It is done. Men will say so at Yule, and for a long time after.'] };
    return;
  }
  for (const b of state.boasts) {
    if (b.state !== 'open' || b.due > state.day) continue;
    breakBoast(state, content, b);
    state.pending = { t: 'report', title: 'A boast unkept', lines: [`You swore it over the cup: ${content.boasts[b.id]?.text}`, 'The year has turned, and it is not done. Men remember a boast longer than a deed.'] };
    return;
  }
  const doy = dateOf(state.day).doy;
  if (state.phase === 'sailing' && state.at === 'home_fjord' && !state.voyage && doy >= FORCE_RETURN_DOY) state.phase = 'return';
  trigger(state, content, rng, 'phase_start');
}
