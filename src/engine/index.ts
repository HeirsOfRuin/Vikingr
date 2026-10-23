// Engine facade. Three calls: newGame, view, act. Pure: act clones the state,
// works on the copy, and returns it. The UI, the bot and the tests all use this.
import { cutRing, makeRing, METALS, RING, ringsOf, ringWords, type Metal } from './rings';
import type { Attr, ContentBundle, DuelMove, Order, Skill } from '../content/schema';
import { DUEL_MOVES, SKILLS } from '../content/schema';
import type { GameState, Pending, Position } from './state';
import { RngCursor, seedRng } from './rng';
import { dateOf, dayOf, formatDate } from './calendar';
import { condPaths, test, unmetLabel } from './conditions';
import type { CondInput } from '../content/schema';
import { applyEffects } from './effects';
import { HOSTAGE, hostageOp, kindsAt } from './hostages';
import { open, trigger } from './director';
import { BOUT_MOVES, boutAvailable, boutExchange, fightOutBout, MOVE_LABEL, moveDesc, type BoutMove } from './bout';
import { available, deployStep, fightOutWall, ORDER_LABEL, orderDesc, wallRound, WALL_ORDERS, type WallOrder } from './wall';
import { checkP, hpMax, learn, effAttr } from './hero';
import { makeupError, skillsOf } from './makeup';
import { childAge, FAMILY, familyActions, foster, goOnAs, heirs, makeHeir, renameChild, takeSon, wedDaughter } from './family';
import { hearNews, newsWaiting, tickChronicle } from './chronicle';
import { courseBlock, coursePath, courseTargets, sailCourse } from './course';
import { AIM_LABEL, BOLD_LABEL, coastTargets, CRUISE, cruiseBlock, cruiseUntil, defaultOrders, endCruise, forecast, LEAD_LABEL, POSITION_WORDS, reckoningWords, runCruise, startCruise } from './cruise';
import { lordAlive, lordName, renounce, swear, swearBlock, swornTo } from './lords';
import { buyBlock, buyLand, canBuyHere, canMuster, digFort, fortBlock, garrisonFor, holdingAt, LAND, musterHolding, claimBlock } from './land';
import { scoutChance, scoutedOdds, scoutedThisYear, scoutPlace } from './scout';
import { addRecruits, aliveMen, capacity, clampMorale, moraleWord, mouths, newMan, payShip, purse, SHIP_NAMES } from './crew';
import { appoint, buyHull, CARGO_UNIT, hullsForSale } from './fleet';
import { FAVOUR, favour, favourWord } from './allies';
import { commitReserve, fightOutHost, fightOutHostWall, hostRound, hostWallRound } from './host';
import { buyLot, buyPrice, canBuy, sellLot, sellPrice, tradesHere } from './trade';
import { GUEST_DAYS, baseStanding, canHire, hireable, landingFoe, norseHeld, resupplyCost, RESUPPLY_DAYS, shiftStanding, standing, tierAt } from './standing';
import { adaptivePolicy as duelInstinct, BEATS, canYield, fightOut, habitPolicy, MOVE_NAMES, resolveExchange } from './duel';
import { adaptivePolicy as battleAuto, availableOrders, doctrinePolicy, enemyForecast, fightOutBattle, INTENSITY, MATCHUP, ORDER_NAMES, POSITION_NAMES, resolveRound } from './battle';
import { finishBattle, finishDuel, freshScout, startBattle, startRaid, surpriseChance } from './fights';
import { breakBoast, goalMet, keepBoast } from './boasts';
import { BASE, canBuildHall, FARM_PRICE, hangable, hangTrophy, hallPrice, keepCaptives, newBase, thrallRoom } from './base';
import { armCost, buy, DEFAULT_KIT, equip, forSale, GEAR_MAX, gearWord, giveItem, type Shop, spareKit, sellValue, sellItem, giveKitTo, itemName } from './items';
import { eatAshore, expeditionRoads, routes, runVoyage, startVoyage, exiled, serviceHome } from './voyage';
import { expeditionBlock, listen, listenable, LISTEN_COST } from './discovery';
import {
  borrowShip, BUILD_TYPES, winterWork, divideAbroad, feastCost, hallAction, provision, provisionCost, recruit, recruitable, refit, refitCost, serviceShare, shareOut, winterHere,
  type HallWhat, type ShareHow,
} from './season';
import { formatSilver, plural } from './format';
import { banter } from './banter';
import { plunderAction, ALARM_MAX, type PlunderWhat } from './plunder';
import { journal } from './journal';
import { renderText } from './text';
import { heal } from './hero';
import { BATTLE, DUEL, SIGN_ON_GIFT, SERVICE_ROUTE, FORCE_RETURN_DOY, LATE_SEASON_DOY, MUSTER_DOY, ORTUG_PER_MARK, ORTUG_PER_POUND, SAILING_DOY, START_YEAR, WINTER_DOY, WINTER_ABROAD_DOY, BIRTH_YEAR } from './tuning';
import { startIn843 } from './era';
import { atHome, homeOf, settleBlock, settleHere, settleHint } from './settle';

export type Action =
  | { t: 'choose'; id: string }
  | { t: 'continue' }
  | { t: 'sail'; to: string }
  | { t: 'voyage_on' }
  | { t: 'raid' }
  | { t: 'scout' }
  | { t: 'course'; to: string }
  | { t: 'cruise_plan' }
  | { t: 'cruise_set'; key: 'coast' | 'days' | 'aim' | 'bold' | 'lead' | 'then' | 'pos'; value: string }
  | { t: 'cruise_go' }
  | { t: 'cruise_cancel' }
  | { t: 'cruise_on' }
  | { t: 'cruise_end' }
  // family and the heir (docs/FRAME-LINEAGE.md B)
  | { t: 'foster'; child: string; with: string }
  | { t: 'take_son'; child: string }
  | { t: 'wed_daughter'; child: string; to: string }
  | { t: 'rename_child'; child: string; name: string }
  | { t: 'heir'; child: string }
  | { t: 'heir_make'; attrs: Record<Attr, number>; set: string }
  | { t: 'swear'; lord: string; how: 'first' | 'open' | 'secret' }
  | { t: 'renounce'; lord: string }
  | { t: 'buy_land' }
  | { t: 'settle' }
  | { t: 'claim_land' }
  | { t: 'dig_fort' }
  | { t: 'muster_land' }
  | { t: 'reinforce' }
  | { t: 'forage' }
  | { t: 'resupply' }
  | { t: 'guest' }
  | { t: 'ale' }
  | { t: 'hire' }
  | { t: 'land' }
  | { t: 'listen' }
  | { t: 'hoard_in'; n?: number }
  | { t: 'hoard_out'; n?: number }
  | { t: 'hang'; item: string }
  | { t: 'make_ring' }
  | { t: 'cut_ring'; metal: Metal }
  | { t: 'keep_thralls' }
  | { t: 'shop' }
  | { t: 'buy'; item: string }
  | { t: 'arm' }
  | { t: 'equip'; uid: string }
  | { t: 'expedition'; to: string }
  | { t: 'rest' }
  | { t: 'end_season' }
  | { t: 'winter_here' }
  | { t: 'hostage'; id: string; op: 'free' | 'sell' }
  | { t: 'passage_home' }
  | { t: 'harek' }
  | { t: 'recruit' }
  | { t: 'provision' }
  | { t: 'refit' }
  | { t: 'borrow_ship' }
  | { t: 'set_sail' }
  | { t: 'stay_home' }
  | { t: 'share'; how: ShareHow }
  | { t: 'hall'; what: HallWhat; arg?: string }
  | { t: 'duel_move'; move: DuelMove }
  | { t: 'bout_move'; move: BoutMove }
  | { t: 'wall_order'; order: WallOrder }
  | { t: 'wall_deploy'; what: 'sworn' | 'reserve' | 'pos'; value: string }
  | { t: 'duel_auto' }
  | { t: 'fight_end' }
  | { t: 'yield' }
  | { t: 'order'; order: Order }
  | { t: 'position'; pos: Position }
  | { t: 'battle_auto' }
  | { t: 'slot'; man: string; slot: Position }
  | { t: 'buy_hull'; type: string }
  | { t: 'trade' }
  | { t: 'divide'; how: ShareHow }
  | { t: 'reserve' }
  | { t: 'signal'; order: 'push' | 'hold' }
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

export type Screen = 'scene' | 'report' | 'duel' | 'battle' | 'plunder' | 'shop' | 'trade' | 'cruise' | 'heir' | 'voyage' | 'place' | 'muster' | 'return' | 'hall' | 'death';

export interface View {
  screen: Screen;
  actions: ActionOption[];
}

export class ActionError extends Error {}

export interface NewGameOptions {
  background: string;
  seed: number;
  name: string;
  /** Point-buy spread (docs/FRAME-LINEAGE.md A); the beginning's own if left out. */
  attrs?: Record<Attr, number>;
  /** Which way he was raised: a skill set id; the first if left out. */
  skillSet?: string;
  /** Horik's days (830, the default) or Ragnarr's days (843) (docs/FRAME-LINEAGE.md D). */
  era?: 830 | 843;
}

export function newGame(content: ContentBundle, opts: NewGameOptions): GameState {
  const bg = content.backgrounds[opts.background];
  if (!bg) throw new Error(`unknown background ${opts.background}`);
  if (opts.attrs) { const e = makeupError(bg.attrs, opts.attrs); if (e) throw new Error(e); }
  const skills = skillsOf(bg, opts.skillSet);
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
      attrs: { ...(opts.attrs ?? bg.attrs) },
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
    stats: { legs: 0, storms: 0, battles: 0, battlesWon: 0, duels: 0, duelsWon: 0, raids: 0, plunder: 0, hungerDays: 0, frontWins: 0 },
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
  if (opts.era === 843) startIn843(state, content, bg.id);
  else open(state, bg.start_scene, content);
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

/** The host's leader: the reserve, and a signal to the other wings (docs/FRAME-HOSTS-FRISIA.md). */
function hostOptions(b: import('./state').BattleState): ActionOption[] {
  if (b.host?.role !== 'host' || b.over) return [];
  const out: ActionOption[] = [];
  if (b.host.reserve.us > 0) out.push(opt('The host', { t: 'reserve' }, 'Throw in the host\'s reserve', !b.host.reserve.usIn, 'The reserve is already in.', `${b.host.reserve.us} men, to whichever wing is closest to breaking`));
  out.push(opt('The host', { t: 'signal', order: 'push' }, 'Signal the wings: push', true, undefined, 'The whole line goes forward next round'));
  out.push(opt('The host', { t: 'signal', order: 'hold' }, 'Signal the wings: hold', true, undefined, 'The flanks lock shields and wait'));
  return out;
}

const upFirst = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);
const opt = (group: string, action: Action, label: string, enabled = true, reason?: string, hint?: string): ActionOption => ({ group, action, label, enabled, reason, hint });

export function screenOf(state: GameState): Screen {
  if (state.death) return 'death';
  const p = state.pending;
  if (p) return p.t;
  if (state.voyage) return 'voyage';
  if (state.phase === 'muster' && atHome(state)) return 'muster';
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
  if (p.market || norseHeld(state, at)) {
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
  if (!atHome(state) || state.voyage) return [];
  const out: ActionOption[] = [];
  // bury a pound, half, or all but a pound; dig up a pound, or the lot
  const LB = ORTUG_PER_POUND;
  const spare = Math.max(0, state.silver - LB);
  if (state.silver < LB * 2) out.push(opt('Your base', { t: 'hoard_in' }, 'Bury silver in your hoard', false, 'You have nothing to spare.'));
  else {
    out.push(opt('Your base', { t: 'hoard_in', n: LB }, 'Bury a pound of silver in your hoard', true, undefined, formatSilver(LB)));
    const half = Math.floor(state.silver / 2);
    if (half > LB) out.push(opt('Your base', { t: 'hoard_in', n: half }, 'Bury half your silver', true, undefined, formatSilver(half)));
    if (spare > half) out.push(opt('Your base', { t: 'hoard_in', n: spare }, 'Bury all but a pound', true, undefined, formatSilver(spare)));
  }
  if (state.base.hoard > LB) out.push(opt('Your base', { t: 'hoard_out', n: LB }, 'Dig up a pound from your hoard', true, undefined, `${formatSilver(state.base.hoard)} buried`));
  out.push(opt('Your base', { t: 'hoard_out' }, 'Dig up the whole hoard', state.base.hoard > 0, 'The hoard is empty.', state.base.hoard > 0 ? formatSilver(state.base.hoard) : undefined));
  out.push(opt('Arm-rings', { t: 'make_ring' }, 'Have the smith make a silver arm-ring', state.silver >= RING.silver.make, `You need ${formatSilver(RING.silver.make)}.`, `${formatSilver(RING.silver.make)}; you hold ${ringWords(state)}`));
  for (const m of METALS) if (ringsOf(state)[m] > 0) out.push(opt('Arm-rings', { t: 'cut_ring', metal: m }, `Cut a ${m} arm-ring into hacksilver`, true, undefined, formatSilver(RING[m].weight)));
  for (const id of hangable(state, content)) out.push(opt('Your base', { t: 'hang', item: id }, `Hang ${content.items[id]!.name.charAt(0).toLowerCase()}${content.items[id]!.name.slice(1)} on the wall`));
  if (!state.service) out.push(...familyActions(state, content, opt));
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
    // go on as his son (docs/FRAME-LINEAGE.md B)
    case 'death': return heirs(state).map((c) => opt('', { t: 'heir', child: c.id }, `Go on as ${c.name}, his ${c.father === state.hero.name ? 'son' : 'brother'}`, true, undefined, `${childAge(state, c)} winters old${childAge(state, c) < FAMILY.heirAt ? `; the years pass until he is ${FAMILY.heirAt}` : ''}`));
    case 'heir': return [];
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
      // the last blow lands, and he stands there and sees it before the aftermath (playtest 6)
      if (d.over) return [opt('', { t: 'fight_end' }, 'Continue', true, undefined, d.over === 'won' || d.over === 'foe_yielded' ? 'He is down' : d.over === 'parted' ? 'It is over, and neither of you won it' : 'It is over')];
      // the second form (docs/FRAME-COMBAT-2.md, revision 2): a move says what it does and costs, not what it will do
      if (d.bout) {
        const out = BOUT_MOVES.map((m) => {
          const a = boutAvailable(d, m);
          return opt('Moves', { t: 'bout_move', move: m }, MOVE_LABEL[m], a.ok, a.why, moveDesc(d, m));
        });
        out.push(opt('Other', { t: 'duel_auto' }, 'Let instinct take it'));
        if (canYield(d)) out.push(opt('Other', { t: 'yield' }, 'Step off the cloak and pay the holmlausn', true, undefined, `${formatSilver(DUEL.holmlausnMarks * ORTUG_PER_MARK)}; honour falls`));
        return out;
      }
      // the triangle, said plainly (playtest 2026-10-15: nothing on screen said what beats what)
      const answers = d.read.length ? DUEL_MOVES.filter((m) => d.read.some((r) => BEATS[m].includes(r))) : [];
      const out = DUEL_MOVES.map((m) => {
        const beats = BEATS[m].map((x) => MOVE_NAMES[x].toLowerCase()).join(', ');
        const loses = DUEL_MOVES.filter((x) => BEATS[x].includes(m)).map((x) => MOVE_NAMES[x].toLowerCase()).join(', ');
        return opt('Moves', { t: 'duel_move', move: m }, MOVE_NAMES[m], true, undefined, `${answers.includes(m) ? 'The answer to what he leans on. ' : ''}Beats a ${beats}; loses to a ${loses}`);
      });
      out.push(opt('Other', { t: 'duel_auto' }, 'Let instinct take it'));
      if (canYield(d)) out.push(opt('Other', { t: 'yield' }, 'Step off the cloak and pay the holmlausn', true, undefined, `${formatSilver(DUEL.holmlausnMarks * ORTUG_PER_MARK)}; honour falls`));
      return out;
    }
    case 'battle': {
      const b = (p as { battle: import('./state').BattleState }).battle;
      if (b.over) return [opt('', { t: 'fight_end' }, 'Continue', true, undefined, b.over === 'won' ? 'The field is yours' : b.over === 'lost' ? 'Back to the ships' : 'Both sides draw off')];
      // the second form (docs/FRAME-COMBAT-2.md): deploy, then answer what they show you, and see the numbers first
      if (b.wall) {
        const w = b.wall;
        if (w.phase === 'deploy') {
          const auto = opt('Other', { t: 'battle_auto' }, 'Let the men handle it');
          if (w.step === 'sworn') return [
            opt('Your sworn men', { t: 'wall_deploy', what: 'sworn', value: 'front' }, 'In the front rank', true, undefined, 'The line hits harder; they bleed first'),
            opt('Your sworn men', { t: 'wall_deploy', what: 'sworn', value: 'spread' }, 'Spread through the line', true, undefined, 'A steadier line'),
            opt('Your sworn men', { t: 'wall_deploy', what: 'sworn', value: 'reserve' }, 'Back with the reserve', true, undefined, 'Safe until the reserve goes in'),
            auto,
          ];
          if (w.step === 'reserve') return [0, 0.15, 0.3].map((r) => opt('The reserve', { t: 'wall_deploy', what: 'reserve', value: String(r) }, r === 0 ? 'Every man in the line' : r < 0.2 ? `Hold back a few (${Math.round(b.us.men * r)})` : `Hold back a strong reserve (${Math.round(b.us.men * r)})`, true, undefined, r === 0 ? 'All the weight in the wall now' : 'Fresh men and breath later')).concat(auto);
          return (['front', 'wall', 'rear'] as Position[]).map((pos) => opt('Your place', { t: 'wall_deploy', what: 'pos', value: pos }, POSITION_NAMES[pos], true, undefined, pos === 'front' ? 'The line fights harder; you see less, and bleed first' : pos === 'wall' ? 'The men see you; less danger' : 'You read them best; little danger, less fame')).concat(auto);
        }
        // no reserve kept, no reserve button
        const out = WALL_ORDERS.filter((o) => o !== 'reserve' || w.reserveMen > 0 || w.reserveIn).map((o) => {
          const a = available(b, o);
          return opt(state.service ? 'Your shout' : 'Orders', { t: 'wall_order', order: o }, ORDER_LABEL[o], a.ok, a.why, orderDesc(b, o));
        });
        out.push(...hostOptions(b));
        out.push(opt('Other', { t: 'battle_auto' }, 'Let the men handle it'));
        return out;
      }
      const ok = availableOrders(b, 'us');
      // what beats what, said plainly, and the best answer to what they look likely to do (playtest 2026-10-15)
      const fc = enemyForecast(b);
      const score = (o: (typeof ok)[number]) => ok.length ? Object.entries(fc).reduce((v, [e, p]) => v + p * MATCHUP[o][e as keyof typeof MATCHUP], 0) : 0;
      const best = Math.max(...ok.map(score));
      const nm = (x: string) => ORDER_NAMES[x as keyof typeof ORDER_NAMES].toLowerCase();
      const out = ok.map((o) => {
        const beats = Object.entries(MATCHUP[o]).filter(([, v]) => v > 0).map(([e]) => nm(e)).join(' or ');
        const loses = Object.entries(MATCHUP[o]).filter(([, v]) => v < 0).map(([e]) => nm(e)).join(' or ');
        const weight = INTENSITY[o].out >= 1.3 ? 'Hits hardest, costs most. ' : INTENSITY[o].in <= 0.7 ? 'Costs few men, does little. ' : '';
        const good = best > 0.05 && score(o) >= best - 0.01 ? 'A good answer to what they look likely to do. ' : '';
        return opt(state.service ? 'Your shout' : 'Orders', { t: 'order', order: o }, ORDER_NAMES[o], true, undefined, `${good}${weight}Beats ${beats}; loses to ${loses}`);
      });
      for (const pos of ['front', 'wall', 'rear'] as Position[]) if (pos !== b.position && !b.heroDown) out.push(opt('Your place', { t: 'position', pos }, `Move to: ${POSITION_NAMES[pos]}`));
      out.push(...hostOptions(b));
      out.push(opt('Other', { t: 'battle_auto' }, 'Let the men handle it'));
      return out;
    }
    case 'cruise': {
      const o = state.cruisePlan!;
      const mark = (on: boolean, label: string) => (on ? `✓ ${label}` : label);
      const out: ActionOption[] = [];
      for (const c of Object.values(content.coasts)) {
        const t = coastTargets(state, content, c.id);
        if (!t.length) continue;
        out.push(opt('The coast', { t: 'cruise_set', key: 'coast', value: c.id }, mark(o.coast === c.id, c.name), true, undefined, `${t.map((id) => content.places[id]!.name).join(', ')}`));
      }
      for (const d of CRUISE.lengths) out.push(opt('How long', { t: 'cruise_set', key: 'days', value: String(d) }, mark(o.days === d, d ? `${d} days` : 'The rest of the summer'), true, undefined, d ? undefined : `Until about ${formatDate(cruiseUntil(state, 0))}`));
      for (const a of ['silver', 'balance', 'captives'] as const) out.push(opt('What to take', { t: 'cruise_set', key: 'aim', value: a }, mark(o.aim === a, AIM_LABEL[a]), true, undefined, a === 'captives' ? 'Slower and louder; worth silver at the slave markets' : a === 'silver' ? 'Strip the houses' : undefined));
      for (const b of ['careful', 'bold'] as const) out.push(opt('How bold', { t: 'cruise_set', key: 'bold', value: b }, mark(o.bold === b, BOLD_LABEL[b]), true, undefined, b === 'careful' ? `Scout every place; leave it alone if they would field more than ${CRUISE.nerve.careful} of them to each of yours. Leave before the countryside comes` : `Raid unless they would field ${CRUISE.nerve.bold} of them to each of yours. Stay longer at the plunder`));
      for (const l of ['all', 'close', 'none'] as const) out.push(opt('Which fights you lead', { t: 'cruise_set', key: 'lead', value: l }, mark(o.lead === l, LEAD_LABEL[l]), true, undefined, l === 'all' ? 'You fight every raid yourself' : l === 'close' ? `You are called when they could field ${CRUISE.close} of them to each of yours, or more` : 'The men fight; you are where your place says you are'));
      for (const pos of ['front', 'wall', 'rear'] as Position[]) out.push(opt('Where you stand when the men fight', { t: 'cruise_set', key: 'pos', value: pos }, mark(state.position === pos, POSITION_WORDS[pos]), true, undefined, pos === 'front' ? 'More fame; you bleed first' : pos === 'rear' ? 'Little danger; less fame, and the men notice' : undefined));
      for (const th of ['home', 'stay'] as const) out.push(opt('Afterwards', { t: 'cruise_set', key: 'then', value: th }, mark(o.then === th, th === 'home' ? 'Sail home' : 'Stay on the coast'), true));
      const block = cruiseBlock(state, content);
      out.push(opt('', { t: 'cruise_go' }, 'Set out', !block, block ?? undefined, block ? undefined : reckoningWords(forecast(state, content, o))));
      out.push(opt('', { t: 'cruise_cancel' }, 'Not now'));
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
      const home = atHome(state);
      const fc = feastCost(state);
      const lord = !state.service; // an oarsman eats at his father's table and does not hold feasts
      if (home) out.push(...shopOption(state, content), ...baseActions(state, content));
      if (home && state.base.level === 'father') out.push(opt('Your base', { t: 'hall', what: 'buy_farm' }, 'Buy a farm of your own', state.silver >= FARM_PRICE, `You need ${formatSilver(FARM_PRICE)}.`, formatSilver(FARM_PRICE)));
      if (home && state.base.level === 'farm') {
        const why = canBuildHall(state);
        out.push(opt('Your base', { t: 'hall', what: 'build_hall' }, state.flags.hall_burned ? 'Rebuild the hall' : 'Build a hall', !why, why ?? undefined, formatSilver(hallPrice(state))));
      }
      if (lord || state.base.level !== 'father') out.push(opt('Hall', { t: 'hall', what: 'feast' }, 'Hold a feast', state.silver >= fc, `You need ${formatSilver(fc)}.`, formatSilver(fc)));
      else {
        const w = winterWork(state);
        if (w) out.push(opt('Hall', { t: 'hall', what: 'work' }, w.label, true, undefined, 'A little silver; the winter passes'));
      }
      // only the rings he holds: made by the smith, given him, or taken (the author, 2026-10-14)
      const r = ringsOf(state);
      for (const m of aliveMen(state)) {
        out.push(opt('Gifts', { t: 'hall', what: 'gift', arg: m.id }, `Give ${m.name} a silver arm-ring`, r.silver > 0, home ? 'You have no silver ring to give. The smith can make one.' : 'You have no silver ring to give.', `Loyalty ${m.loyalty}/10; you hold ${plural(r.silver, 'silver ring')}`));
        if (r.gold > 0) out.push(opt('Gifts', { t: 'hall', what: 'gift_gold', arg: m.id }, `Give ${m.name} a gold arm-ring`, true, undefined, `Loyalty ${m.loyalty}/10; you hold ${plural(r.gold, 'gold ring')}`));
      }
      out.push(opt('Hall', { t: 'hall', what: 'train' }, lord ? 'Train with the men' : 'Practise with your bench-mates'));
      out.push(opt('Hall', { t: 'hall', what: 'rest' }, 'Rest and heal'));
      if (state.flags.skald) out.push(opt('Hall', { t: 'hall', what: 'skald' }, 'Have the skald compose'));
      if (home && !state.service) out.push(opt('The jarl', { t: 'hall', what: 'jarl_gift' }, 'Send the jarl a gift', state.silver >= FAVOUR.giftCost, `You need ${formatSilver(FAVOUR.giftCost)}.`, `${formatSilver(FAVOUR.giftCost)}; his favour: ${favourWord(favour(state))}`));
      if (home && !state.service && r.gold > 0) out.push(opt('The jarl', { t: 'hall', what: 'jarl_gift', arg: 'gold' }, 'Send the jarl a gold arm-ring', true, undefined, `Twice the favour of any other gift; his favour: ${favourWord(favour(state))}`));
      // hostages (docs/FRAME-HIRD-HOSTAGES.md): ransom and surety come by their kin's go-between; these two are his alone
      if (home) for (const h of state.hostages ?? []) {
        out.push(opt('Hostages', { t: 'hostage', id: h.id, op: 'free' }, `Send ${h.name} home without a ransom`, true, undefined, `${h.who}; honour, and their people's goodwill`));
        out.push(opt('Hostages', { t: 'hostage', id: h.id, op: 'sell' }, `Sell ${h.name}${h.n > 1 ? ' and the children' : ''} to the slave-trader`, true, undefined, `${formatSilver(h.n * HOSTAGE.sellEach)}; their people will not forget it`));
      }
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
      if (!state.service && (shops.includes('smith') || shops.includes('market'))) out.push(opt(shops.includes('smith') ? 'The smith' : 'The booths', { t: 'make_ring' }, 'Have a silver arm-ring made', state.silver >= RING.silver.make, `You need ${formatSilver(RING.silver.make)}.`, `${formatSilver(RING.silver.make)}; you hold ${ringWords(state)}`));
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
        ...(!state.service && kindsAt(content, pl.place).length ? [opt('Plunder', { t: 'plunder', what: 'hostage' }, 'Look for someone worth a ransom', !pl.searched, 'You have looked already.', 'A king\'s kin, an abbot, a lord\'s wife and children; slow and loud')] : []),
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
        const shome = serviceHome(state);
        if (dest && dest !== at) out.push(opt('Sail', { t: 'follow' }, `Row on with ${svc.captain}`, true, undefined, `Bound for ${content.places[dest]?.name ?? dest}`));
        else if (at !== shome) out.push(opt('Sail', { t: 'follow' }, shome === 'home_fjord' ? `Row home with ${svc.captain}` : `Row to ${content.places[shome]!.name} with ${svc.captain}`, true, undefined, `Bound for ${content.places[shome]!.name}`));
        else out.push(opt('Season', { t: 'end_season' }, 'Haul up the ship for the winter'));
        return out;
      }
      // a-viking along a coast on standing orders (docs/FRAME-PACING.md)
      if (state.cruise) {
        const c = state.cruise;
        const left = Math.max(0, c.until - state.day);
        out.push(opt('Sail', { t: 'cruise_on' }, `Carry on along ${content.coasts[c.orders.coast]?.name ?? 'the coast'}`, true, undefined, `${plural(left, 'day')} left of your orders; your men call you when they need you`));
        out.push(opt('Sail', { t: 'cruise_end' }, 'Break off, and take stock', true, undefined, c.orders.then === 'home' ? 'Then the road home' : 'Stay where you are'));
      } else if (state.ships.length && state.crew.men >= 6 && defaultOrders(state, content)) {
        out.push(opt('Sail', { t: 'cruise_plan' }, 'Go a-viking along a coast', true, undefined, 'Give your orders; the men sail, scout and raid, and call you when they need you'));
      }
      // a course set and broken off: hold it (docs/FRAME-PACING.md)
      if (state.course && state.ships.length && state.course !== at) {
        const c = coursePath(state, content, at, state.course);
        const why = c ? courseBlock(state, content, c.path[0]!) : null;
        if (c) out.push(opt('Sail', { t: 'course', to: state.course }, `Hold your course for ${content.places[state.course]!.name}`, !why, why ?? undefined, `About ${c.days} days, ${c.path.length === 1 ? 'one leg' : `${c.path.length} legs`}; stops if anything happens`));
      }
      if (state.ships.length) {
        for (const r of routes(state, content, at)) {
          const short = state.provisions < mouths(state) * r.days;
          out.push(opt('Sail', { t: 'sail', to: r.to }, `Sail to ${content.places[r.to]!.name}`, true, undefined, `About ${r.days} days, ${r.leg.kind === 'open' ? 'open sea' : r.leg.kind}${short ? '. Not enough food' : ''}`));
        }
      } else if (at !== homeOf(state) && !exiled(state)) out.push(opt('Sail', { t: 'passage_home' }, state.silver >= 12 ? 'Take passage home on a trader' : 'Work your passage home on a trader', true, undefined, state.silver >= 12 ? formatSilver(12) : 'No silver: a month at another man\'s oar'));
      // an outlaw castaway can't go home: a trader takes him west, to the one hall that will have him
      else if (at !== 'orkney' && exiled(state)) out.push(opt('Sail', { t: 'passage_home' }, state.silver >= 12 ? 'Take passage to Orkney on a trader' : 'Work your passage to Orkney on a trader', true, undefined, state.silver >= 12 ? formatSilver(12) : 'No silver: a month at another man\'s oar'));
      else if (at === 'orkney' && exiled(state) && !state.service) out.push(opt('Sail', { t: 'harek' }, "Go to Harek's hall, and ask for a bench", true, undefined, 'Another summer at his oar'));
      if (place.raid && !norseHeld(state, at) && at !== homeOf(state)) {
        const done = state.seasonRaids.includes(at);
        // what the scouts saw rides on the raid button while it holds (docs/FRAME-WORLD.md §A)
        const odds = scoutedOdds(state, content, at);
        const sc = freshScout(state, at);
        const hint = odds ? `Scouted: about ${odds.asleep} if asleep, ${odds.awake} if awake; ${Math.round(odds.p * 10)} in 10 to catch them asleep` : sc && !sc.ok ? `They saw your scouts: ${Math.round(surpriseChance(state, content, at) * 10)} in 10 to catch them asleep` : undefined;
        out.push(opt('Here', { t: 'raid' }, `Raid ${place.name}`, !done && state.crew.men >= 6, done ? 'You raided it this summer already.' : 'You have too few men.', hint));
        if (!done) {
          const looked = scoutedThisYear(state, at);
          out.push(opt('Here', { t: 'scout' }, 'Send men up to look', !looked, 'Your men have looked at it this summer already.', `A day; cunning and wits, ${checkWord(scoutChance(state, content, at))}. If they are seen, the place is warned`));
        }
      }
      // what this port will do for him depends on what it thinks of him (DESIGN §11.6)
      const tier = tierAt(state, content, at);
      if (at !== homeOf(state)) {
        if (tier === 'hostile') {
          const lf = landingFoe(content, at);
          out.push(opt('Here', { t: 'land' }, 'Fight your way ashore for water and cattle', state.crew.men >= 6, 'You have too few men.', `They will meet you on the beach: about ${lf.men} of them`));
        } else {
          const rc = resupplyCost(state, content, at);
          if (rc) out.push(opt('Here', { t: 'resupply' }, 'Buy food from the locals', rc.need > 0 && purse(state) > 0, rc.need <= 0 ? 'The ships are provisioned.' : 'You have no silver, and nothing in the heap.', rc.need > 0 ? `${formatSilver(rc.cost)} for ${RESUPPLY_DAYS} days${tier === 'wary' ? ', at a wary price' : tier === 'allied' ? ', at a friend\'s price' : ''}` : undefined));
          if (content.places[at]!.market || norseHeld(state, at)) out.push(...shopOption(state, content));
          out.push(...tradeOption(state, content));
          const year = dateOf(state.day).year;
          if (GUEST_DAYS[tier] > 0) out.push(opt('Here', { t: 'guest' }, 'Ask for guest-right', state.places[at]?.guested !== year, 'You have had their hospitality this year.', `Food for ${GUEST_DAYS[tier]} days, free, once a year`));
          // a crew's spirits can be mended in port, not only by winning (playtest 2026-10-15)
          if (!state.service && state.crew.men > 0) {
            const cost = Math.ceil(state.crew.men * BATTLE.alePerMan);
            const last = state.places[at]?.aled;
            const fresh = last === undefined || state.day - last >= BATTLE.aleDays;
            out.push(opt('Here', { t: 'ale' }, 'Stand the men a round', fresh && state.silver >= cost && state.crew.morale < BATTLE.aleCap, !fresh ? 'You stood them a round here not long ago.' : state.crew.morale >= BATTLE.aleCap ? 'Their spirits are high enough.' : `You need ${formatSilver(cost)}.`, `${formatSilver(cost)}; the crew is ${moraleWord(state.crew.morale)}`));
          }
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
      for (const c of courseTargets(state, content)) {
        const short = state.provisions < mouths(state) * c.days;
        const why = courseBlock(state, content, coursePath(state, content, at, c.to)!.path[0]!);
        out.push(opt('Course', { t: 'course', to: c.to }, `Set a course for ${content.places[c.to]!.name}`, !why, why ?? undefined, `About ${c.days} days, ${c.legs} legs${short ? '. Not enough food for the whole road' : ''}; stops if anything happens`));
      }
      out.push(...lordOptions(state, content, at), ...landOptions(state, content, at));
      // rumours of far places, and expeditions to them (FRAME-FOUNDATION §1)
      if (tier !== 'hostile' && listenable(state, content, at)) out.push(opt('Here', { t: 'listen' }, 'Stand the old sailors a round, and listen', state.silver >= LISTEN_COST, `You need ${formatSilver(LISTEN_COST)} for the ale.`, `${formatSilver(LISTEN_COST)}; a day; rumours of far places`));
      if (state.ships.length) for (const r of expeditionRoads(state, content, at)) {
        const why = expeditionBlock(state, content);
        out.push(opt('Sail', { t: 'expedition', to: r.to }, `Mount an expedition to ${content.places[r.to]!.name}`, !why, why ?? undefined, `Uncharted water: about ${r.days} days, maybe more`));
      }
      if (at === homeOf(state)) {
        out.push(...homeActions(state, content));
        out.push(opt('Season', { t: 'end_season' }, 'Haul up the ships for the winter', doy >= LATE_SEASON_DOY, 'Too early: the summer is not done.'));
      } else if (doy >= WINTER_ABROAD_DOY || doy < MUSTER_DOY) out.push(opt('Season', { t: 'winter_here' }, `Winter at ${place.name}`, tier !== 'hostile' && tier !== 'unfriendly', 'Nobody here will give you a roof.'));
      return out;
    }
  }
}

/** Lords (docs/FRAME-WORLD.md §C): his oath offered at a lord's own hall; an oath given back. */
function lordOptions(state: GameState, content: ContentBundle, at: string): ActionOption[] {
  if (state.service || state.voyage) return [];
  const out: ActionOption[] = [];
  for (const l of Object.values(content.lords)) {
    if (l.seat !== at || !lordAlive(state, content, l.id)) continue;
    const name = lordName(state, content, l.id);
    const why = swearBlock(state, content, l.id);
    if (swornTo(state, l.id)) continue;
    const old = state.oath?.lord;
    if (!old) out.push(opt('Lords', { t: 'swear', lord: l.id, how: 'first' }, `Offer ${name} your oath`, !why, why ?? undefined, `${l.title}. His call, his tenth, his friends left alone; his men, his protection, his land`));
    else {
      const oldName = lordName(state, content, old);
      out.push(opt('Lords', { t: 'swear', lord: l.id, how: 'open' }, `Give ${oldName} back his oath, and swear to ${name}`, !why, why ?? undefined, `${oldName} will think the less of you, and take back any land he gave you`));
      out.push(opt('Lords', { t: 'swear', lord: l.id, how: 'secret' }, `Swear to ${name} as well, and tell ${oldName} nothing`, !why, why ?? undefined, 'Two lords. If it comes out, you lose honour and both cast you out'));
    }
  }
  // an oath can be given back at home, or at the lord's own hall
  for (const o of [state.oath, state.oath2]) {
    if (!o) continue;
    const seat = content.lords[o.lord]!.seat;
    if (at === seat || at === 'home_fjord') out.push(opt('Lords', { t: 'renounce', lord: o.lord }, `Send ${lordName(state, content, o.lord)} back his oath`, true, undefined, 'Openly: no oath broken, but he will think the less of you, and take back any land he gave'));
  }
  return out;
}

/** Land abroad (docs/FRAME-WORLD.md §D): buying it, digging a fort, calling out its men, holding it. */
function landOptions(state: GameState, content: ContentBundle, at: string): ActionOption[] {
  if (state.service || state.voyage || at === 'home_fjord') return [];
  const out: ActionOption[] = [];
  const h = holdingAt(state, at);
  if (!h && content.places[at]!.landnam !== undefined) { const why = claimBlock(state, content, at); out.push(opt('Land', { t: 'claim_land' }, 'Take land here: carry fire round its bounds', !why, why ?? undefined, `Free, and nobody's but yours: ${formatSilver(LAND.claimed.yield)} a year at first, ${plural(LAND.claimed.men, 'man', 'men')} each spring. Then bring your family, and settle it`)); }
  if (!h && canBuyHere(state, at)) { const why = buyBlock(state, content, at); out.push(opt('Land', { t: 'buy_land' }, 'Buy land here', !why, why ?? undefined, `${formatSilver(LAND.price)}. Winter here as at home; ${LAND.bought.men} men each spring; ${formatSilver(LAND.bought.yield)} a year`)); }
  if (!h && content.places[at]!.raid && state.places[at]?.wonOn !== undefined && dateOf(state.places[at]!.wonOn!).year === dateOf(state.day).year) {
    const why = fortBlock(state, content, at);
    out.push(opt('Land', { t: 'dig_fort' }, 'Dig a ship-fort here, and hold it', !why, why ?? undefined, `Ten days; leave ${plural(garrisonFor(state), 'man', 'men')} to hold it. ${formatSilver(LAND.fort.yield)} a year, if they don't take it back`));
  }
  if (h && canMuster(state, at)) out.push(opt('Land', { t: 'muster_land' }, 'Call out your people here', true, undefined, `Up to ${plural(LAND[h.kind].men, 'man', 'men')}, and food`));
  if (h && homeOf(state) !== at) { const why = settleBlock(state, content); out.push(opt('Land', { t: 'settle' }, 'Bring your family and your men\'s families, and settle here', !why, why ?? undefined, settleHint(state, content))); }
  if (h?.kind === 'fort') out.push(opt('Land', { t: 'reinforce' }, 'Leave five more men to hold the fort', state.crew.men > 10, 'You can\'t spare them.', `${plural(h.garrison ?? 0, 'man', 'men')} hold it now. More men, less chance they take it back`));
  return out;
}

/** A chance in the words the scene checks use. */
function checkWord(p: number): string {
  return p < 0.4 ? 'risky' : p <= 0.65 ? 'even' : 'favourable';
}

function checkBand(state: GameState, content: ContentBundle, c: { skill: Skill; attr: import('../content/schema').Attr; difficulty: number }): string {
  const p = checkChance(state, content, c);
  return upFirst(checkWord(p));
}

export function checkChance(state: GameState, content: ContentBundle, c: { skill: Skill; attr: import('../content/schema').Attr; difficulty: number }): number {
  return checkP(state, content, c);
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
  if (action.t !== 'slot' && action.t !== 'equip' && action.t !== 'appoint' && action.t !== 'give_item' && action.t !== 'rename_child' && action.t !== 'heir_make' && (!allowed || !allowed.enabled)) throw new ActionError(`not available now: ${JSON.stringify(action)}${allowed?.reason ? ' — ' + allowed.reason : ''}`);
  const state = structuredClone(input);
  const rng = new RngCursor(state.rng);
  const report = (title: string, lines: string[], next?: string, art?: { key: string; laughter?: string }) => {
    if (!state.pending && lines.length) state.pending = { t: 'report', title, lines, next, art: art?.key, laughter: art?.laughter };
  };
  // the road and the coast: what happened before a scene broke in is told when the scene is done (playtest 6)
  const reportAfter = (title: string, lines: string[]) => {
    if (!lines.length) return;
    if (!state.pending) report(title, lines, undefined, { key: 'open_sea' });
    else state.after = { title, lines };
  };

  switch (action.t) {
    case 'continue': {
      const next = state.pending?.t === 'report' ? state.pending.next : undefined;
      const then = state.pending?.t === 'report' ? state.pending.then : undefined;
      state.pending = then === 'heir' ? { t: 'heir' } : null;
      delete state.shopNote;
      if (next) open(state, next, content);
      break;
    }
    case 'claim_land': open(state, 'is_landnam', content); break;
    case 'settle': report('Home', settleHere(state, content)); break;
    case 'foster': report('Fostering', foster(state, content, action.child, action.with)); break;
    case 'take_son': report('Your son', takeSon(state, content, action.child)); break;
    case 'wed_daughter': report('A wedding', wedDaughter(state, content, action.child, action.to)); break;
    case 'rename_child': { const e = renameChild(state, action.child, action.name); if (e) throw new ActionError(e); break; }
    case 'heir': goOnAs(state, content, rng, action.child); break;
    case 'heir_make': {
      if (state.pending?.t !== 'heir') throw new ActionError('not available now: heir_make');
      const e = makeHeir(state, content, action.attrs, action.set);
      if (e) throw new ActionError(e);
      state.pending = null;
      open(state, 'fa_mound', content);
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
      // what went into the hold, said plainly after the scene's own words
      if (state.notes?.length) { text = `${text ?? ''}\n\n${state.notes.join('\n\n')}`.trim(); delete state.notes; }
      const pd = state.pending as Pending | null;
      if (pd) {
        if (text && pd.t === 'duel') pd.duel.log.unshift(text);
        if (text && pd.t === 'battle') pd.battle.log.unshift(text);
      } else if (text) report(scene.title, text.trim().split(/\n\s*\n/), next, typeof scene.art === 'string' ? { key: scene.art } : scene.art);
      else if (next) open(state, next, content);
      break;
    }
    case 'cruise_plan':
      state.cruisePlan = defaultOrders(state, content)!;
      state.pending = { t: 'cruise' };
      break;
    case 'cruise_set': {
      const o = state.cruisePlan!;
      if (action.key === 'days') o.days = Number(action.value);
      else if (action.key === 'pos') state.position = action.value as Position;
      else (o as unknown as Record<string, string>)[action.key] = action.value;
      state.pending = { t: 'cruise' };
      break;
    }
    case 'cruise_cancel':
      state.pending = null;
      delete state.cruisePlan;
      break;
    case 'cruise_go': {
      const o = state.cruisePlan!;
      state.pending = null;
      delete state.cruisePlan;
      startCruise(state, content, o);
      reportAfter(content.coasts[o.coast]!.name, runCruise(state, content, rng));
      break;
    }
    case 'cruise_on':
      reportAfter(content.coasts[state.cruise!.orders.coast]!.name, runCruise(state, content, rng));
      break;
    case 'cruise_end':
      reportAfter(content.coasts[state.cruise!.orders.coast]!.name, endCruise(state, content, rng, 'You break off and take stock.'));
      break;
    case 'course': {
      state.course = action.to;
      reportAfter('At sea', sailCourse(state, content, rng));
      break;
    }
    case 'sail':
    case 'follow':
    case 'voyage_on': {
      if (action.t === 'sail') { delete state.course; startVoyage(state, content, action.to); }
      if (action.t === 'follow') startVoyage(state, content, state.service?.route[0] ?? serviceHome(state), true);
      const r = runVoyage(state, content, rng);
      // a leg of a course, interrupted and finished: the course goes on unless something else has the stage
      if (action.t === 'voyage_on' && r.arrived && state.course && !state.pending) r.lines.push(...sailCourse(state, content, rng));
      if (action.t === 'voyage_on' && r.arrived && state.cruise && !state.pending) r.lines.push(...runCruise(state, content, rng));
      const talk = banter(state, content, rng, 'sea', 0.6);
      if (talk) r.lines.push(talk);
      reportAfter('At sea', r.lines);
      break;
    }
    case 'take_share': report('The share-out', serviceShare(state, content, rng)); break;
    case 'plunder':
      plunderAction(state, content, rng, action.what);
      break;
    case 'raid':
      startRaid(state, content, rng, state.at!);
      break;
    case 'scout':
      report('Scouts', scoutPlace(state, content, rng, state.at!));
      break;
    case 'swear': {
      const before = state.flags.oathbreaker ?? 0;
      report('An oath', swear(state, content, action.lord, action.how));
      if ((state.flags.oathbreaker ?? 0) > before) state.queue.push({ scene: 'lo_cast_out', day: state.day });
      state.day += 1;
      break;
    }
    case 'renounce':
      report('An oath given back', renounce(state, content, action.lord));
      break;
    case 'buy_land':
      report('Land', buyLand(state, content, state.at!));
      break;
    case 'dig_fort':
      report('A ship-fort', digFort(state, content, state.at!));
      break;
    case 'muster_land':
      report('Your people', musterHolding(state, content, state.at!));
      break;
    case 'reinforce': {
      const h = holdingAt(state, state.at)!;
      state.crew.men -= 5;
      h.garrison = (h.garrison ?? 0) + 5;
      report('The fort', [`Five men take their sea-chests off the ships and carry them up to the fort. ${plural(h.garrison, 'man', 'men')} hold it now.`]);
      break;
    }
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
    case 'make_ring':
    case 'cut_ring': {
      const line = action.t === 'make_ring' ? makeRing(state) : cutRing(state, action.metal);
      if (state.pending?.t === 'shop') state.shopNote = line;
      else report('Arm-rings', [line]);
      break;
    }
    case 'keep_thralls': {
      const n = keepCaptives(state);
      report('Thralls', [`${plural(n, 'captive')} ${n === 1 ? 'goes' : 'go'} up the hill to ${BASE[state.base.level].name.toLowerCase()}, to cut turf and carry water and muck out the byre. ${state.base.wife ? `${state.base.wife} looks them over the way she looks at a new cow.` : 'Your mother looks at them a long time, and does not say what she thinks.'}`]);
      break;
    }
    case 'listen': {
      state.silver -= LISTEN_COST;
      state.day += 1;
      report('Old sailors', [...listen(state, content, rng, state.at!), ...hearNews(state, true)]);
      break;
    }
    case 'expedition': {
      startVoyage(state, content, action.to, false, true);
      journal(state, `Set out on an expedition to ${content.places[action.to]!.name}.`);
      const r = runVoyage(state, content, rng);
      report('Uncharted water', ['The last land you know goes down behind you. After that there is only the sea, and what the old men said.', ...r.lines], undefined, { key: 'open_sea' });
      break;
    }
    case 'ale': {
      const cost = Math.ceil(state.crew.men * BATTLE.alePerMan);
      state.silver -= cost;
      state.places[state.at!]!.aled = state.day;
      state.crew.morale = Math.min(BATTLE.aleCap, state.crew.morale + BATTLE.aleMorale);
      clampMorale(state);
      state.day += 1;
      report('A round for the men', [`You stand the whole crew ale at the longest table in ${content.places[state.at!]!.name}, ${formatSilver(cost)} of it, and sit with them while they drink it. By the end of the night they are singing, badly, and by the morning they are talking about the next fight as if they meant to win it.`]);
      break;
    }
    case 'guest': {
      const days = GUEST_DAYS[tierAt(state, content, state.at!)];
      state.crew.morale = Math.min(BATTLE.aleCap, state.crew.morale + 1);
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
      // three quiet days ashore steady a shaken crew, though they won't lift a sullen one past ordinary
      if (state.crew.morale < BATTLE.restCap) state.crew.morale = Math.min(BATTLE.restCap, state.crew.morale + BATTLE.restMorale);
      break;
    case 'end_season':
      // another man's ship comes home when he says; the captain keeps her out until the autumn
      if (state.service) state.day = Math.max(state.day, dayOf(dateOf(state.day).year, LATE_SEASON_DOY));
      state.phase = 'return';
      break;
    case 'hostage': {
      const h = (state.hostages ?? []).find((x) => x.id === action.id);
      if (!h) break;
      state.hfocus = h.id;
      const who = h.who;
      hostageOp(state, content, rng, action.op);
      report(action.op === 'free' ? 'Sent home' : 'Sold', [action.op === 'free'
        ? `You send ${who} home with an escort as far as the border of their own country, and food for the road. The kin do not thank you. But they will remember it, and so will everyone who hears.`
        : `The slave-trader looks over ${who} the way he looks over everything, and pays by the head. They go down to his boat without looking back at you. By the spring they will be in Dublin or Hedeby, and nobody there will care who they were.`]);
      break;
    }
    case 'winter_here':
      report('Winter abroad', winterHere(state, content, rng));
      break;
    case 'passage_home': {
      const paid = state.silver >= 12;
      if (paid) state.silver -= 12;
      state.day += paid ? 12 : 30;
      state.fedTo = state.day; // a passenger eats the trader's food
      if (exiled(state)) {
        state.at = 'orkney';
        report('Orkney', [paid ? 'A trader takes you west to Orkney for silver and a hand at the oars. It isn\'t home. It\'s the nearest thing you have.' : 'A trader takes you west to Orkney for nothing but your back at his oars. It isn\'t home. It\'s the nearest thing you have.']);
        break;
      }
      state.at = homeOf(state);
      report('Home', [paid ? 'A trader takes you home for silver and a hand at the oars.' : 'A trader takes you home for nothing but your back at his oars, by the longest way round, with a stop at every market between.']);
      break;
    }
    case 'harek': {
      // an outlaw without a ship goes back to the bench that fed him
      state.service = { captain: 'Harek', route: [], shares: 1, home: 'orkney' };
      state.ships = [{ id: 'service', type: 'snekkja', name: "Harek's Sea-Stallion", hull: 90 }];
      state.crew.men = Math.max(state.crew.men, 26);
      report('Birsay', ['Harek looks at you a long while, and at what\'s left of your men. "Wolf\'s heads eat," he says. "Find a bench."']);
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
    case 'share': report('The share-out', shareOut(state, content, action.how, rng)); break;
    case 'hall': report('The hall', hallAction(state, content, rng, action.what, action.arg)); break;
    case 'bout_move':
    case 'duel_move':
    case 'duel_auto':
    case 'yield': {
      const d = (state.pending as { t: 'duel'; duel: import('./state').DuelState }).duel;
      if (action.t === 'yield') d.over = 'yielded';
      else if (action.t === 'bout_move') boutExchange(d, action.move, rng);
      else if (action.t === 'duel_auto' && d.bout) fightOutBout(d, rng, true);
      else if (action.t === 'duel_auto') fightOut(d, duelInstinct, rng, true);
      else resolveExchange(d, action.move, habitPolicy(d, 'foe', rng), rng);
      break;
    }
    case 'fight_end': {
      const pd = state.pending;
      if (pd?.t === 'duel' && pd.duel.over) finishDuel(state, content, rng, pd.duel);
      else if (pd?.t === 'battle' && pd.battle.over) finishBattle(state, content, rng, pd.battle);
      break;
    }
    case 'wall_deploy':
    case 'wall_order':
    case 'order':
    case 'battle_auto':
    case 'position': {
      const b = (state.pending as { t: 'battle'; battle: import('./state').BattleState }).battle;
      if (action.t === 'wall_deploy') { deployStep(b, action.what, action.value, rng); if (b.wall?.phase === 'fight') state.position = b.position; }
      else if (action.t === 'wall_order') { if (b.host) hostWallRound(b, action.order, rng); else wallRound(b, action.order, rng); }
      else if (action.t === 'battle_auto' && b.wall) { if (b.host) fightOutHostWall(b, rng); else fightOutWall(b, rng); }
      else if (action.t === 'position') {
        b.position = action.pos;
        state.position = action.pos;
        b.log.push(`You take your place: ${POSITION_NAMES[action.pos].toLowerCase()}.`);
      } else if (action.t === 'battle_auto') { if (b.host) fightOutHost(b, battleAuto, rng); else fightOutBattle(b, battleAuto, rng); }
      else if (b.host) hostRound(b, action.order, rng);
      else resolveRound(b, action.order, doctrinePolicy(b, 'them', rng), rng);
      break;
    }
    case 'reserve':
    case 'signal': {
      const b = (state.pending as { t: 'battle'; battle: import('./state').BattleState }).battle;
      if (action.t === 'reserve') commitReserve(b);
      else { b.host!.signal = action.order; b.log.push(`You signal the wings: ${action.order === 'push' ? 'push' : 'hold'}. The horns take it down the line.`); }
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
  if (!state.hero.alive) return;
  // the world goes on without him (docs/FRAME-WORLD.md §B)
  tickChronicle(state, content);
  // days ashore abroad eat from the stores, the same as days at sea
  const hungry = eatAshore(state);
  if (hungry && !state.pending) state.pending = { t: 'report', title: 'Hungry', lines: [hungry] };
  if (state.pending) return;
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
  // what the road or the coast held, told after the scene that broke in on it
  if (state.after) {
    state.pending = { t: 'report', title: state.after.title, lines: state.after.lines, art: 'open_sea' };
    delete state.after;
    return;
  }
  // news that has come into this port ahead of him
  if (newsWaiting(state, content)) {
    state.pending = { t: 'report', title: 'News', lines: hearNews(state) };
    return;
  }
  const doy = dateOf(state.day).doy;
  if (state.phase === 'sailing' && state.at === (state.service ? serviceHome(state) : homeOf(state)) && !state.voyage && doy >= FORCE_RETURN_DOY) state.phase = 'return';
  trigger(state, content, rng, 'phase_start');
}
