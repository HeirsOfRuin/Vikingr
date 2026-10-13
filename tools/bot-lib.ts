// Reference players. They do not need to play well; they need to play consistently,
// so two runs are comparable (game-building skill, Part 2 #5).
import { FARM_PRICE, HALL_PRICE } from '../src/engine/base';
import type { ContentBundle } from '../src/content/schema';
import type { GameState, Position } from '../src/engine/state';
import { act, listActions, newGame, screenOf, type Action, type ActionOption } from '../src/engine/index';
import { RngCursor, seedRng } from '../src/engine/rng';
import { dateOf } from '../src/engine/calendar';
import { routes } from '../src/engine/voyage';
import { mouths, aliveMen } from '../src/engine/crew';
import { hpMax } from '../src/engine/hero';
import { untoldCount } from '../src/engine/fame';
import { armCost } from '../src/engine/items';
import { LATE_SEASON_DOY } from '../src/engine/tuning';

export type Policy = 'raider' | 'reckless' | 'coward' | 'homebody' | 'random';
export const POLICIES: Policy[] = ['raider', 'reckless', 'coward', 'homebody', 'random'];

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
  constructor(public policy: Policy, public rng: RngCursor) {}

  position(): Position {
    return this.policy === 'reckless' ? 'front' : this.policy === 'coward' ? 'rear' : 'wall';
  }

  choose(state: GameState, content: ContentBundle): Action | null {
    const opts = listActions(state, content);
    // shopping and listening are deliberate choices below, never a fallback
    const enabled = opts.filter((o) => o.enabled && o.action.t !== 'shop' && o.action.t !== 'listen');
    if (!enabled.length) return null;
    if (this.policy === 'random') return enabled[this.rng.int(enabled.length)]!.action;
    const screen = screenOf(state);
    const pick = (pred: (a: Action) => boolean) => find(opts, pred)?.action;
    switch (screen) {
      case 'scene': return enabled[this.rng.int(enabled.length)]!.action;
      case 'report': case 'voyage': return enabled[0]!.action;
      case 'duel': {
        const y = pick((a) => a.t === 'yield');
        const d = state.pending!.t === 'duel' ? state.pending!.duel : null;
        if (y && this.policy !== 'reckless' && d && d.hero.hp < d.hero.hpMax * 0.35) return y;
        return pick((a) => a.t === 'duel_auto')!;
      }
      case 'battle': {
        const b = state.pending!.t === 'battle' ? state.pending!.battle : null;
        if (b && b.position !== this.position() && !b.heroDown && b.round === 0) return { t: 'position', pos: this.position() };
        return pick((a) => a.t === 'battle_auto')!;
      }
      case 'shop': {
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
        if (this.policy !== 'homebody' && state.silver > 120 && !this.shopped.has(state.day)) { this.shopped.add(state.day); const s = pick((a) => a.t === 'shop'); if (s) return s; }
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
    if (sulky && sulky.loyalty <= 4 && state.silver > 60) { const g = h('gift', sulky.id); if (g) return g; }
    const sk = h('skald'); if (sk && state.deeds.some((d) => d.told !== null && !d.verse)) return sk;
    if (state.flags.owes_jarl && state.silver > 260) { const b = h('buy_ship'); if (b) return b; }
    const hang = pick((a) => a.t === 'hang'); if (hang) return hang;
    if (state.silver > FARM_PRICE + 150) { const b = h('buy_farm'); if (b) return b; }
    if (state.silver > HALL_PRICE + 150) { const b = h('build_hall'); if (b) return b; }
    if (state.silver > 700 && state.ships.length < 3) { const b = h('build', 'snekkja'); if (b) return b; }
    if (state.silver > 120 && state.hamingja < 2) { const b = h('blot'); if (b) return b; }
    return h('train')!;
  }

  place(state: GameState, content: ContentBundle, opts: ActionOption[]): Action {
    const pick = (pred: (a: Action) => boolean) => find(opts, pred)?.action;
    const at = state.at!;
    const doy = dateOf(state.day).doy;
    // at another man's oar the captain decides: follow him, and haul up when he does
    if (state.service) return pick((a) => a.t === 'follow') ?? pick((a) => a.t === 'end_season') ?? opts.find((o) => o.enabled)!.action;
    const raid = pick((a) => a.t === 'raid');
    if (raid && this.policy !== 'homebody') return raid;
    this.visited.add(at);
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
      const targets = state.known.filter((id) => content.places[id]?.raid && !state.seasonRaids.includes(id));
      targets.sort((a, b) => hops(state, content, at, a) - hops(state, content, at, b));
      target = targets[0] ?? state.known.find((id) => !this.visited.has(id) && content.places[id]?.active) ?? null;
    }
    if (!target) target = 'home_fjord';
    if (target === at) return pick((a) => a.t === 'rest') ?? opts.find((o) => o.enabled)!.action;
    const hop = nextHop(state, content, at, target);
    const sail = hop ? pick((a) => a.t === 'sail' && a.to === hop) : undefined;
    if (sail) return sail;
    return pick((a) => a.t === 'passage_home') ?? pick((a) => a.t === 'winter_here') ?? pick((a) => a.t === 'rest') ?? opts.find((o) => o.enabled)!.action;
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
export function playLife(content: ContentBundle, policy: Policy, seed: number, years: number, background = 'younger_son', until?: (s: GameState) => boolean): RunResult {
  let state = newGame(content, { background, seed, name: 'Bot' });
  const bot = new Bot(policy, new RngCursor(seedRng(seed ^ 0x5bd1e995)));
  const startYear = dateOf(state.day).year;
  let steps = 0;
  let lastDay = state.day;
  let still = 0;
  while (!state.death && dateOf(state.day).year < startYear + years && !until?.(state)) {
    const a = bot.choose(state, content);
    if (!a) return { policy, seed, steps, years: dateOf(state.day).year - startYear, state, error: `dead end on ${screenOf(state)} at day ${state.day}` };
    try {
      state = act(content, state, a);
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
