// Reference players. They do not need to play well; they need to play consistently,
// so two runs are comparable (game-building skill, Part 2 #5).
import { hirdRoom } from '../src/engine/hird';
import { FARM_PRICE, HALL_PRICE, hallPrice } from '../src/engine/base';
import { hold, holdRoom, SECONDHAND } from '../src/engine/fleet';
import { buyPrice, sellPrice } from '../src/engine/trade';
import { partner } from '../src/engine/allies';
import { scoutedOdds } from '../src/engine/scout';
import type { Attr, ContentBundle } from '../src/content/schema';
import type { GameState, Position } from '../src/engine/state';
import { act, listActions, newGame, screenOf, type Action, type ActionOption } from '../src/engine/index';
import { RngCursor, seedRng } from '../src/engine/rng';
import { dateOf } from '../src/engine/calendar';
import { routes } from '../src/engine/voyage';
import { mouths, aliveMen } from '../src/engine/crew';
import { hpMax } from '../src/engine/hero';
import { untoldCount } from '../src/engine/fame';
import { armCost } from '../src/engine/items';
import { LATE_SEASON_DOY, WINTER_ABROAD_DOY } from '../src/engine/tuning';
import { holdingAt } from '../src/engine/land';
import { SEAT_DEF } from '../src/engine/rule';
import { getValue } from '../src/engine/paths';
import { armyCamp } from '../src/engine/sailfleet';
import { landPath } from '../src/engine/march';

/** Switches for A/B measurement (tools/measure-scout.ts). */
export const BOT_OPTS = { scout: true, /** Go a-viking along a coast on standing orders (docs/FRAME-PACING.md). */ cruise: false, /** Take land and settle on it (docs/FRAME-LINEAGE.md C, E): off in the check, on in measure:lineage. */ settle: false };

export type Policy = 'raider' | 'reckless' | 'coward' | 'homebody' | 'random';
export const POLICIES: Policy[] = ['raider', 'reckless', 'coward', 'homebody', 'random'];

// instant actions (the hoard, the wall, shops) are deliberate choices, never a fallback: they don't move time
const INSTANT = ['cruise_plan', 'course', 'shop', 'listen', 'trade', 'hoard_in', 'hoard_out', 'hang', 'sell_item', 'give_item', 'divide', 'equip', 'appoint', 'make_ring', 'cut_ring', 'skald_aboard'];
const fallback = (opts: ActionOption[]) => (opts.find((o) => o.enabled && !INSTANT.includes(o.action.t)) ?? opts.find((o) => o.enabled)!).action;
const find = (opts: ActionOption[], pred: (a: Action) => boolean) => opts.find((o) => o.enabled && pred(o.action));

/** Next hop on the shortest known route from `from` to `to`. */
function nextHop(state: GameState, content: ContentBundle, from: string, to: string): string | null {
  const prev: Record<string, string> = {};
  const q = [from];
  const seen = new Set([from]);
  while (q.length) {
    const cur = q.shift()!;
    if (cur === to) break;
    for (const r of routes(state, content, cur)) {
      if (!seen.has(r.to)) {
        seen.add(r.to);
        prev[r.to] = cur;
        q.push(r.to);
      }
    }
  }
  if (!seen.has(to) || to === from) return null;
  let cur = to;
  while (prev[cur] !== from) cur = prev[cur]!;
  return cur;
}

function hops(state: GameState, content: ContentBundle, from: string, to: string): number {
  let n = 0;
  let cur = from;
  while (cur !== to && n < 20) {
    const h = nextHop(state, content, cur, to);
    if (!h) return 99;
    cur = h;
    n++;
  }
  return n;
}

export class Bot {
  visited = new Set<string>(['home_fjord']);
  shopped = new Set<number>();
  traded = new Set<string>();
  /** Places looked at and left alone this summer ("year:place"). */
  passed = new Set<string>();
  /** The day the orders could not be given (holds full, hurt, no food), and the day they last were. */
  noPlan = -1;
  planned = '';
  bought = new Map<number, number>();
  harried = new Set<string>();
  constructor(public policy: Policy, public rng: RngCursor) {}

  position(): Position {
    return this.policy === 'reckless' ? 'front' : this.policy === 'coward' ? 'rear' : 'wall';
  }

  private east = new Set<number>();
  private eastBound = 0;
  private eastDone = false;
  choose(state: GameState, content: ContentBundle): Action | null {
    const opts = listActions(state, content);
    // shopping and listening are deliberate choices below, never a fallback
    const enabled = opts.filter((o) => o.enabled && !INSTANT.includes(o.action.t));
    if (!enabled.length) return null;
    if (this.policy === 'random') return enabled[this.rng.int(enabled.length)]!.action;
    const screen = screenOf(state);
    const pick = (pred: (a: Action) => boolean) => find(opts, pred)?.action;
    switch (screen) {
      case 'scene': {
        // a lord who wants men takes the oath when he can (docs/FRAME-HIRD-HOSTAGES.md)
        const id = state.pending!.t === 'scene' ? state.pending!.id : '';
        if (id.startsWith('hi_') && this.policy !== 'homebody') { const sw = pick((a) => a.t === 'choose' && a.id === 'swear'); if (sw) return sw; }
        // a single combat on offer: anyone but a reckless man listens to the men's reckoning (docs/FRAME-DUEL-3.md)
        // and turns down a fight they say he'd lose
        const grim = (o: ActionOption) => /he'd (kill|likely beat|beat) you/.test(o.hint ?? '');
        if (this.policy !== 'reckless' && enabled.some(grim)) {
          const safe = enabled.filter((o) => !grim(o));
          if (safe.length) return safe[this.rng.int(safe.length)]!.action;
        }
        return enabled[this.rng.int(enabled.length)]!.action;
      }
      case 'report': case 'voyage': return enabled[0]!.action;
      case 'cruise': {
        // orders: the coast the plan opens on (the one he knows most of), the rest of the summer, home after
        const o = state.cruisePlan!;
        if (o.lead !== 'none') return { t: 'cruise_set', key: 'lead', value: 'none' };
        if (o.bold !== (this.policy === 'coward' ? 'careful' : 'bold') && this.policy !== 'raider') return { t: 'cruise_set', key: 'bold', value: this.policy === 'coward' ? 'careful' : 'bold' };
        if (!pick((a) => a.t === 'cruise_go')) { this.noPlan = state.day; return { t: 'cruise_cancel' }; }
        return { t: 'cruise_go' };
      }
      case 'duel': {
        const fe = pick((a) => a.t === 'fight_end');
        if (fe) return fe;
        const y = pick((a) => a.t === 'yield');
        const d = state.pending!.t === 'duel' ? state.pending!.duel : null;
        if (y && this.policy !== 'reckless' && d && d.hero.hp < d.hero.hpMax * 0.35) return y;
        return pick((a) => a.t === 'duel_auto')!;
      }
      case 'battle': {
        const fe = pick((a) => a.t === 'fight_end');
        if (fe) return fe;
        const b = state.pending!.t === 'battle' ? state.pending!.battle : null;
        if (b?.wall?.phase === 'deploy') {
          const w = b.wall;
          return w.step === 'sworn' ? { t: 'wall_deploy', what: 'sworn', value: 'spread' }
            : w.step === 'reserve' ? { t: 'wall_deploy', what: 'reserve', value: b.them.men > b.us.men * 1.1 ? '0.15' : '0' }
            : { t: 'wall_deploy', what: 'pos', value: this.position() };
        }
        if (b && !b.wall && b.position !== this.position() && !b.heroDown && b.round === 0) return { t: 'position', pos: this.position() };
        return pick((a) => a.t === 'battle_auto')!;
      }
      case 'trade': {
        // sell what pays; buy what this beach makes cheap and some other market wants, with silver to spare
        const at = state.at!;
        for (const [g, c] of Object.entries(state.cargo ?? {})) {
          if (sellPrice(state, content, at, g) >= (c.cost / c.lots) * 1.05) return { t: 'trade_sell', good: g };
        }
        if ((this.bought.get(state.day) ?? 0) < 12) {
          for (const g of content.places[at]!.trade?.cheap ?? []) {
            const wanted = Object.values(content.places).some((p) => p.id !== at && p.trade?.dear.includes(g) && state.known.includes(p.id));
            const a = opts.find((o) => o.enabled && o.action.t === 'trade_buy' && o.action.good === g);
            if (wanted && a && state.silver - buyPrice(state, content, at, g) > 150) {
              this.bought.set(state.day, (this.bought.get(state.day) ?? 0) + 1);
              return a.action;
            }
          }
        }
        return { t: 'continue' };
      }
      case 'strand': {
        // the shore between the ports (playtest 10): land if the odds are good enough for this captain
        const t = (state.pending as { target: { men: number } }).target;
        const ours = state.crew.men + aliveMen(state).length;
        const nerve = this.policy === 'reckless' ? 1.6 : this.policy === 'raider' ? 1.0 : 0.6;
        if (t.men <= ours * nerve) return { t: 'strand', what: 'land' };
        return pick((a) => a.t === 'strand' && a.what === 'back') ?? enabled[0]!.action;
      }
      case 'shop': {
        // a second hull when rich: a knarr if the holds are the trouble, else a karvi (docs/FRAME-FLEET.md)
        if (state.ships.length < 2 && !state.service) {
          const want = state.loot > hold(state, content) * 0.8 ? 'knarr' : 'karvi';
          const h = opts.find((o) => o.enabled && o.action.t === 'buy_hull' && o.action.type === want);
          if (h && state.silver - Math.round(content.ships[want]!.cost * SECONDHAND) > 150) return h.action;
        }
        // buy what a sensible captain would, keeping a mark in hand
        const prefer = ['arm', 'helmet', 'mail', 'caulking', 'new_sail', 'shield_rack', 'frankish_sword', 'carved_prow'];
        for (const want of prefer) {
          const a = opts.find((o) => o.enabled && ((want === 'arm' && o.action.t === 'arm') || (o.action.t === 'buy' && o.action.item === want)));
          const cost = !a ? 0 : a.action.t === 'arm' ? armCost(state) ?? 0 : a.action.t === 'buy' ? content.items[a.action.item]?.price ?? 0 : 0;
          if (a && state.silver - cost > 24) return a.action;
        }
        return { t: 'continue' };
      }
      case 'muster': {
        if (state.service) return pick((a) => a.t === 'set_sail') ?? enabled[0]!.action;
        if (this.policy !== 'homebody' && state.silver > (state.base.level === 'father' && !state.service ? FARM_PRICE + 120 : 120) && !this.shopped.has(state.day)) { this.shopped.add(state.day); const s = pick((a) => a.t === 'shop'); if (s) return s; }
        if (this.policy === 'homebody') return pick((a) => a.t === 'stay_home')!;
        return pick((a) => a.t === 'borrow_ship') ?? pick((a) => a.t === 'recruit') ?? pick((a) => a.t === 'refit') ?? pick((a) => a.t === 'provision') ?? pick((a) => a.t === 'set_sail') ?? enabled[0]!.action;
      }
      case 'return': {
        if (state.service) return pick((a) => a.t === 'take_share')!;
        // a farm of his own wants hands; at his father's they are worth more sold
        if (state.base.level !== 'father') { const k = pick((a) => a.t === 'keep_thralls'); if (k) return k; }
        const how = state.loot > 600 ? 'generous' : this.policy === 'coward' ? 'mean' : 'fair';
        return pick((a) => a.t === 'share' && a.how === how)!;
      }
      case 'plunder': {
        const p = state.pending!.t === 'plunder' ? state.pending!.plunder : null;
        const limit = this.policy === 'reckless' ? 8.5 : this.policy === 'coward' ? 4 : 6.5;
        if (p && p.alarm >= limit) return pick((a) => a.t === 'plunder' && a.what === 'leave')!;
        if (p && this.policy === 'raider' && p.round === 1) return pick((a) => a.t === 'plunder' && a.what === 'captives')!;
        // someone worth a ransom (docs/FRAME-HIRD-HOSTAGES.md): the careful raider looks, once
        if (p && this.policy === 'raider' && p.round === 2) { const hs = pick((a) => a.t === 'plunder' && a.what === 'hostage'); if (hs) return hs; }
        return pick((a) => a.t === 'plunder' && a.what === 'grab')!;
      }
      case 'hall': return this.hall(state, content, opts);
      case 'place': return this.place(state, content, opts);
    }
    return enabled[0]!.action;
  }

  hall(state: GameState, content: ContentBundle, opts: ActionOption[]): Action {
    const pick = (pred: (a: Action) => boolean) => find(opts, pred)?.action;
    const h = (what: string, arg?: string) => pick((a) => a.t === 'hall' && a.what === what && (arg === undefined || a.arg === arg));
    if (state.hero.hp < hpMax(state, content) * 0.7) return h('rest') ?? h('train')!;
    if (untoldCount(state) > 0) { const f = h('feast'); if (f) return f; }
    const sulky = aliveMen(state).sort((a, b) => a.loyalty - b.loyalty)[0];
    // a ring for the sulkiest man: the smith makes one first if there is none to give
    if (sulky && sulky.loyalty <= 4) {
      const g = h('gift_gold', sulky.id) ?? h('gift', sulky.id);
      if (g) return g;
      if (state.silver > 60) { const mk = pick((a) => a.t === 'make_ring'); if (mk) return mk; }
    }
    // a ring in the chest for the next man who asks to swear (docs/FRAME-HIRD-HOSTAGES.md)
    if (hirdRoom(state) > 0 && (state.rings?.silver ?? 0) < 1 && state.silver > 150) { const mk = pick((a) => a.t === 'make_ring'); if (mk) return mk; }
    // a gold ring is worth more to the jarl than in the chest
    { const jg = h('jarl_gift', 'gold'); if (jg) return jg; }
    const sk = h('skald'); if (sk && state.deeds.some((d) => d.told !== null && !d.verse)) return sk;
    if (state.flags.owes_jarl && state.silver > 260) { const b = h('buy_ship'); if (b) return b; }
    const hang = pick((a) => a.t === 'hang'); if (hang) return hang;
    // the bold take the skald to sea; the careful leave him at the jarl's benches (playtest 8)
    { const want = this.policy === 'raider' || this.policy === 'reckless'; const sa = pick((a) => a.t === 'skald_aboard' && a.on === want); if (sa) return sa; }
    if (state.silver > FARM_PRICE + 24) { const b = h('buy_farm'); if (b) return b; }
    if (state.silver > hallPrice(state) + 150) { const b = h('build_hall'); if (b) return b; }
    if (state.silver > HALL_PRICE / 2 + 100) { const b = h('hall_frame'); if (b) return b; }
    if (state.silver > 700 && state.ships.length < 3) { const b = h('build', 'snekkja'); if (b) return b; }
    if (state.silver > 120 && state.hamingja < 2) { const b = h('blot'); if (b) return b; }
    return h('train')!;
  }

  /** The first step of the road to `to`, if there is one and no sea road. */
  walk(state: GameState, content: ContentBundle, pick: (p: (a: Action) => boolean) => Action | undefined, from: string, to: string): Action | undefined {
    const lp = landPath(content, from, to);
    return lp ? pick((a) => a.t === 'march' && a.to === lp.path[0]) : undefined;
  }

  place(state: GameState, content: ContentBundle, opts: ActionOption[]): Action {
    const pick = (pred: (a: Action) => boolean) => find(opts, pred)?.action;
    const at = state.at!;
    const doy = dateOf(state.day).doy;
    // at another man's oar the captain decides: follow him, and haul up when he does
    // the road the story set him on, and the way back to ships left hauled up inland (src/engine/march.ts)
    const road = pick((a) => a.t === 'march' && a.to === state.marchTo);
    if (road) return road;
    if (state.inland && !state.service) { const back = this.walk(state, content, pick, state.at!, state.inland); if (back) return back; }
    if (state.service) return pick((a) => a.t === 'follow') ?? pick((a) => a.t === 'end_season') ?? fallback(opts);
    // the bold take the skald to sea; the careful leave him at the jarl's benches (playtest 8)
    { const want = this.policy === 'raider' || this.policy === 'reckless'; const sa = pick((a) => a.t === 'skald_aboard' && a.on === want); if (sa) return sa; }
    const raid = pick((a) => a.t === 'raid');
    const year = dateOf(state.day).year;
    if (raid && this.policy !== 'homebody' && !this.passed.has(`${year}:${at}`)) {
      // the careful ones send men up to look first, and walk away from a fight they can't win (docs/FRAME-WORLD.md §A)
      if (BOT_OPTS.scout && (this.policy === 'raider' || this.policy === 'coward')) {
        const sc = pick((a) => a.t === 'scout');
        if (sc) return sc;
        const odds = scoutedOdds(state, content, at);
        const ours = state.crew.men + aliveMen(state).length + (partner(state, content) ? 40 : 0);
        const nerve = this.policy === 'raider' ? 1.2 : 0.8;
        const expected = odds ? odds.p * odds.asleep + (1 - odds.p) * odds.awake : null;
        // seen by the place's dogs: the raider goes in anyway, the coward goes home
        if ((expected !== null && expected > ours * nerve) || (expected === null && this.policy === 'coward')) this.passed.add(`${year}:${at}`);
        else return raid;
      } else return raid;
    }
    // the shore between the ports, once in a while, for the bold (playtest 10)
    if ((this.policy === 'raider' || this.policy === 'reckless') && !this.harried.has(`${state.day}:${at}`) && this.rng.float() < 0.3) {
      this.harried.add(`${state.day}:${at}`);
      const h = pick((a) => a.t === 'harry');
      if (h) return h;
    }
    this.visited.add(at);
    // the East road (docs/FRAME-PLACES-EAST.md): now and then a raider or a careful trader goes east from Birka
    if ((this.policy === 'raider' || this.policy === 'coward') && doy < 200 && !this.east.has(year) && (at === 'birka' || at === 'gotland')) {
      this.east.add(year);
      const exo = opts.find((o) => o.action.t === 'expedition' && (o.action as { to: string }).to === 'aldeigjuborg');
      if (exo && !exo.enabled) {
        // food and a sound hull for open water first, then go
        this.east.delete(year);
        const fix = pick((a) => a.t === 'resupply') ?? pick((a) => a.t === 'refit');
        if (fix) return fix;
      } else if (exo && this.rng.float() < 0.6) return exo.action;
    }
    // heard of the East road, with one light ship: once a life, go and look (docs/FRAME-PLACES-EAST.md)
    if (!this.eastDone && doy < 150 && state.rumoured.includes('aldeigjuborg') && state.known.includes('birka') && getValue(state, content, 'ships.portable') && (this.policy === 'raider' || this.policy === 'coward')) {
      this.eastDone = true;
      if (this.rng.float() < 0.5) this.eastBound = year;
    }
    if (this.eastBound === year && at !== 'birka' && doy < 200) {
      const hop = nextHop(state, content, at, 'birka');
      const go = hop ? pick((a) => a.t === 'sail' && a.to === hop) : undefined;
      if (go) return go;
    }
    // standing orders (docs/FRAME-PACING.md): carry on, or plan the summer
    if (BOT_OPTS.cruise) {
      const on = pick((a) => a.t === 'cruise_on');
      if (on) return on;
      if (doy < LATE_SEASON_DOY - 40 && this.noPlan !== state.day && this.planned !== `${state.day}`) { const plan = pick((a) => a.t === 'cruise_plan'); if (plan && this.policy !== 'homebody') { this.planned = `${state.day}`; return plan; } }
    }
    // land in a new country, and a household brought to land he holds (docs/FRAME-LINEAGE.md C, E)
    if (BOT_OPTS.settle && this.policy !== 'random') {
      const claim = pick((a) => a.t === 'claim_land');
      if (claim) return claim;
      const st = pick((a) => a.t === 'settle');
      if (st && (state.base.wife || this.policy === 'homebody')) return st;
    }
    // lords and land (docs/FRAME-WORLD.md §C-D): the careful swear openly; the reckless take a second oath and a fort
    if (this.policy !== 'homebody') {
      const sw = pick((a) => a.t === 'swear' && a.how === (this.policy === 'reckless' ? 'secret' : 'first')) ?? pick((a) => a.t === 'swear' && a.how === 'first');
      if (sw) return sw;
    }
    const ml = pick((a) => a.t === 'muster_land');
    if (ml) return ml;
    if (this.policy === 'raider' && state.silver > 700) { const b = pick((a) => a.t === 'buy_land'); if (b) return b; }
    if (this.policy === 'reckless' || (this.policy === 'raider' && state.crew.men >= 55)) { const f = pick((a) => a.t === 'dig_fort'); if (f) return f; }
    if (doy >= WINTER_ABROAD_DOY && (holdingAt(state, at) || (state.rule && SEAT_DEF[state.rule.seat].place === at))) { const w = pick((a) => a.t === 'winter_here'); if (w) return w; }
    // a sullen crew loses: mend it in port before the next fight (playtest 2026-10-15)
    if (state.crew.morale <= 4) { const al = pick((a) => a.t === 'ale'); if (al) return al; }
    // the old sailors at the fire: a round of ale for a rumour (FRAME-FOUNDATION §1), once a year a port
    if (state.silver > 20) { const ls = pick((a) => a.t === 'listen'); if (ls) return ls; }
    // holds nearly full in mid-summer: share out on the strand and go on (playtest 4)
    if (state.loot > 0 && holdRoom(state, content) < 200) { const d = pick((a) => a.t === 'divide' && a.how === 'fair'); if (d) return d; }
    // the trading beach, once a landfall, when there is something to sell or silver to spend
    const tk = `${state.day}:${at}`;
    if (!this.traded.has(tk) && (Object.keys(state.cargo ?? {}).length || state.silver > 200)) {
      const t = pick((a) => a.t === 'trade');
      if (t) { this.traded.add(tk); return t; }
    }
    const hungry = state.provisions < mouths(state) * 6;
    // top up wherever they'll sell, before it is urgent
    if (at !== 'home_fjord' && state.provisions < mouths(state) * 15) { const buy = pick((a) => a.t === 'resupply') ?? pick((a) => a.t === 'guest'); if (buy) return buy; }
    // food: buy it where they'll sell, take it where they won't, fight for it where they hate you
    if (hungry && at !== 'home_fjord') { const f = pick((a) => a.t === 'resupply') ?? pick((a) => a.t === 'guest') ?? pick((a) => a.t === 'forage') ?? (this.policy === 'reckless' || this.policy === 'raider' ? pick((a) => a.t === 'land') : undefined); if (f) return f; }
    if (this.policy !== 'coward') { const h = pick((a) => a.t === 'hire'); if (h) return h; }
    if (at === 'home_fjord') {
      const end = pick((a) => a.t === 'end_season');
      if (end) return end;
      const prov = pick((a) => a.t === 'provision');
      if (prov && hungry) return prov;
      const rec = pick((a) => a.t === 'recruit');
      if (rec) return rec;
    }
    // hungry, and nobody here will feed him: go home, where they always will
    const goingHome = doy >= LATE_SEASON_DOY - 20 || (hungry && at !== 'home_fjord');
    let target: string | null = null;
    if (!goingHome) {
      // no single crew goes up against a town: big places only with a partner beside him
      const strength = state.crew.men + (partner(state, content) ? 40 : 0);
      const targets = state.known.filter((id) => content.places[id]?.raid && !state.seasonRaids.includes(id) && !this.passed.has(`${dateOf(state.day).year}:${id}`) && content.places[id]!.raid!.defenders <= strength * 1.8);
      targets.sort((a, b) => hops(state, content, at, a) - hops(state, content, at, b));
      target = targets[0] ?? state.known.find((id) => !this.visited.has(id) && content.places[id]?.active) ?? null;
    }
    // a ruler abroad goes to be seen at his seat before the winter, every other year at least
    if (goingHome && state.rule && SEAT_DEF[state.rule.seat].place !== 'home_fjord' && dateOf(state.day).year - state.rule.seen >= 1) target = SEAT_DEF[state.rule.seat].place;
    // a captain in an army that keeps a winter camp winters in it (docs/FRAME-865.md)
    const camp = armyCamp(state);
    if (camp && (goingHome || hungry) && !(state.holdings ?? []).length) {
      if (at === camp) { const w = pick((a) => a.t === 'winter_here'); if (w) return w; }
      target = camp;
    }
    if (!target) target = 'home_fjord';
    if (target === at) return pick((a) => a.t === 'rest') ?? fallback(opts);
    const hop = nextHop(state, content, at, target);
    const sail = hop ? pick((a) => a.t === 'sail' && a.to === hop) : undefined;
    if (sail) return sail;
    const walk = hop ? undefined : this.walk(state, content, pick, at, target);
    if (walk) return walk;
    return pick((a) => a.t === 'passage_home') ?? pick((a) => a.t === 'winter_here') ?? pick((a) => a.t === 'rest') ?? fallback(opts);
  }
}

export interface RunResult {
  policy: Policy;
  seed: number;
  steps: number;
  years: number;
  state: GameState;
  error: string | null;
}

/** Plays one life (or `years` of it). Errors on dead ends and softlocks instead of hanging. */
export function playLife(content: ContentBundle, policy: Policy, seed: number, years: number, background = 'younger_son', until?: (s: GameState) => boolean, make?: { attrs?: Record<Attr, number>; skillSet?: string; era?: 830 | 843 | 865 }): RunResult {
  let state = newGame(content, { background, seed, name: 'Bot', ...make });
  const bot = new Bot(policy, new RngCursor(seedRng(seed ^ 0x5bd1e995)));
  const startYear = dateOf(state.day).year;
  let steps = 0;
  let lastDay = state.day;
  let still = 0;
  while (!state.death && dateOf(state.day).year < startYear + years && !until?.(state)) {
    const a = bot.choose(state, content);
    if (!a) return { policy, seed, steps, years: dateOf(state.day).year - startYear, state, error: `dead end on ${screenOf(state)} at day ${state.day}` };
    try {
      state = act(content, state, a, { inPlace: true });
    } catch (e) {
      return { policy, seed, steps, years: dateOf(state.day).year - startYear, state, error: `action failed: ${(e as Error).message}` };
    }
    steps++;
    if (state.day === lastDay) {
      if (++still > 300) return { policy, seed, steps, years: dateOf(state.day).year - startYear, state, error: `softlock: 300 actions with no time passing on ${screenOf(state)}` };
    } else {
      still = 0;
      lastDay = state.day;
    }
  }
  return { policy, seed, steps, years: dateOf(state.day).year - startYear, state, error: null };
}
