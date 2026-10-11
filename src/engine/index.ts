// Engine facade. Three calls: newGame, view, act. Pure: act clones the state,
// works on the copy, and returns it. The UI, the bot and the tests all use this.
import type { ContentBundle, DuelMove, Order, Skill } from '../content/schema';
import { DUEL_MOVES, SKILLS } from '../content/schema';
import type { GameState, Pending, Position } from './state';
import { RngCursor, seedRng } from './rng';
import { dateOf, dayOf } from './calendar';
import { test, unmetLabel } from './conditions';
import { applyEffects } from './effects';
import { open, trigger } from './director';
import { hpMax, learn, effAttr } from './hero';
import { aliveMen, capacity, mouths, newMan } from './crew';
import { adaptivePolicy as duelInstinct, canYield, fightOut, habitPolicy, MOVE_NAMES, resolveExchange } from './duel';
import { adaptivePolicy as battleAuto, availableOrders, doctrinePolicy, fightOutBattle, ORDER_NAMES, POSITION_NAMES, resolveRound } from './battle';
import { finishBattle, finishDuel, startBattle, startRaid } from './fights';
import { routes, runVoyage, startVoyage } from './voyage';
import {
  borrowShip, BUILD_TYPES, feastCost, hallAction, provision, provisionCost, recruit, recruitable, refit, refitCost, shareOut, winterHere,
  type HallWhat, type ShareHow,
} from './season';
import { formatSilver, plural } from './format';
import { heal } from './hero';
import { FORCE_RETURN_DOY, LATE_SEASON_DOY, MUSTER_DOY, ORTUG_PER_MARK, SAILING_DOY, START_YEAR, WINTER_DOY, BIRTH_YEAR } from './tuning';

export type Action =
  | { t: 'choose'; id: string }
  | { t: 'continue' }
  | { t: 'sail'; to: string }
  | { t: 'voyage_on' }
  | { t: 'raid' }
  | { t: 'forage' }
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
  | { t: 'slot'; man: string; slot: Position };

export interface ActionOption {
  action: Action;
  label: string;
  enabled: boolean;
  reason?: string;
  hint?: string;
  group: string;
}

export type Screen = 'scene' | 'report' | 'duel' | 'battle' | 'voyage' | 'place' | 'muster' | 'return' | 'hall' | 'death';

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
    ships: [{ id: 'borrowed', type: bg.ship, name: "The jarl's old karvi", hull: 80 }],
    crew: { men: bg.crew, quality: 0.6, morale: 6 },
    men: bg.men.map((id) => newMan(content, id)),
    at: 'home_fjord',
    voyage: null,
    deeds: [],
    flags: Object.fromEntries((bg.flags ?? []).map((f) => [f, 1])),
    seen: {},
    queue: [],
    known: Object.values(content.places).filter((p) => p.known && p.active).map((p) => p.id),
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
  };
  state.hero.hp = hpMax(state, content);
  state.musterPool = 4 + 2 * effAttr(state, content, 'pre');
  // the first season's food comes from the farm and the jarl
  state.provisions = mouths(state) * 20;
  open(state, bg.start_scene);
  return state;
}

// ---- view ----

const opt = (group: string, action: Action, label: string, enabled = true, reason?: string, hint?: string): ActionOption => ({ group, action, label, enabled, reason, hint });

export function screenOf(state: GameState): Screen {
  if (state.death) return 'death';
  const p = state.pending;
  if (p) return p.t === 'scene' ? 'scene' : p.t === 'report' ? 'report' : p.t;
  if (state.voyage) return 'voyage';
  if (state.phase === 'muster' && state.at === 'home_fjord') return 'muster';
  if (state.phase === 'return') return 'return';
  if (state.phase === 'winter') return 'hall';
  return 'place';
}

function homeActions(state: GameState, content: ContentBundle): ActionOption[] {
  const out: ActionOption[] = [];
  const n = recruitable(state, content);
  const room = capacity(state, content) - state.crew.men - aliveMen(state).length;
  out.push(opt('Muster', { t: 'recruit' }, n > 0 ? `Sign on ${plural(n, 'man', 'men')}` : 'Sign on men', n > 0,
    n > 0 ? undefined : room <= 0 ? 'Your ships are full.' : state.musterPool <= 0 ? 'No one else in the district will sign on this year.' : 'You cannot pay the sign-on gifts.',
    `${formatSilver(3)} each`));
  const pc = provisionCost(state);
  out.push(opt('Muster', { t: 'provision' }, 'Buy provisions', pc.need > 0 && state.silver > 0,
    pc.need <= 0 ? 'The ships are provisioned.' : 'You have no silver.', pc.need > 0 ? `${formatSilver(pc.cost)} for 40 days` : undefined));
  const rc = refitCost(state);
  if (state.ships.length) out.push(opt('Muster', { t: 'refit' }, 'Refit the ships', rc > 0 && state.silver >= rc, rc <= 0 ? 'The ships are sound.' : `You need ${formatSilver(rc)}.`, rc > 0 ? formatSilver(rc) : undefined));
  if (!state.ships.length) out.push(opt('Muster', { t: 'borrow_ship' }, "Borrow a ship from the jarl", true, undefined, 'For a quarter of the plunder'));
  return out;
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
        .filter((c) => test(c.visible_if, state, content))
        .map((c) => {
          const ok = test(c.requires, state, content);
          return opt('', { t: 'choose', id: c.id }, c.text, ok, ok ? undefined : `Requires ${unmetLabel(c.requires!, state, content)}`, c.check ? checkBand(state, content, c.check) : undefined);
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
      const out = ok.map((o) => opt('Orders', { t: 'order', order: o }, ORDER_NAMES[o]));
      for (const pos of ['front', 'wall', 'rear'] as Position[]) if (pos !== b.position && !b.heroDown) out.push(opt('Your place', { t: 'position', pos }, `Move to: ${POSITION_NAMES[pos]}`));
      out.push(opt('Other', { t: 'battle_auto' }, 'Let the men handle it'));
      return out;
    }
    case 'voyage': return [opt('', { t: 'voyage_on' }, 'Sail on')];
    case 'muster': {
      const out = homeActions(state, content);
      const doy = dateOf(state.day).doy;
      const canSail = state.ships.length > 0 && state.crew.men >= 6;
      out.push(opt('Sail', { t: 'set_sail' }, doy < SAILING_DOY ? 'Put to sea early' : 'Put to sea', canSail, state.ships.length ? 'You need at least six men at the oars.' : 'You have no ship.', doy < SAILING_DOY ? 'The spring storms are not done' : undefined));
      out.push(opt('Sail', { t: 'stay_home' }, 'Stay home this summer', true, undefined, 'No plunder; the men grumble'));
      return out;
    }
    case 'return': {
      const pot = state.loot;
      return [
        opt('Share-out', { t: 'share', how: 'generous' }, 'Share with an open hand', true, undefined, `Keep 15% of ${formatSilver(pot)}`),
        opt('Share-out', { t: 'share', how: 'fair' }, 'Share as custom has it', true, undefined, 'Keep 30%'),
        opt('Share-out', { t: 'share', how: 'mean' }, 'Keep the lord\'s share and more', true, undefined, 'Keep 50%'),
      ];
    }
    case 'hall': {
      const out: ActionOption[] = [];
      const home = state.at === 'home_fjord';
      const fc = feastCost(state);
      out.push(opt('Hall', { t: 'hall', what: 'feast' }, 'Hold a feast', state.silver >= fc, `You need ${formatSilver(fc)}.`, formatSilver(fc)));
      for (const m of aliveMen(state)) out.push(opt('Gifts', { t: 'hall', what: 'gift', arg: m.id }, `Give ${m.name} an arm-ring`, state.silver >= ORTUG_PER_MARK, `You need ${formatSilver(ORTUG_PER_MARK)}.`, `Loyalty ${m.loyalty}/10`));
      out.push(opt('Hall', { t: 'hall', what: 'train' }, 'Train with the men'));
      out.push(opt('Hall', { t: 'hall', what: 'rest' }, 'Rest and heal'));
      if (state.flags.skald) out.push(opt('Hall', { t: 'hall', what: 'skald' }, 'Have the skald compose'));
      if (home) out.push(opt('Hall', { t: 'hall', what: 'blot' }, 'Hold a blót', state.silver >= 12, `You need ${formatSilver(12)}.`, formatSilver(12)));
      if (home && !state.building) for (const t of BUILD_TYPES) {
        const st = content.ships[t]!;
        out.push(opt('Ships', { t: 'hall', what: 'build', arg: t }, `Build a ${st.name.toLowerCase()}`, state.silver >= st.cost, `You need ${formatSilver(st.cost)}.`, formatSilver(st.cost)));
      }
      if (home && state.flags.owes_jarl && state.ships.length) {
        const c = content.ships.karvi!.cost;
        out.push(opt('Ships', { t: 'hall', what: 'buy_ship' }, "Buy the karvi from the jarl", state.silver >= c, `You need ${formatSilver(c)}.`, formatSilver(c)));
      }
      return out;
    }
    case 'place': {
      const out: ActionOption[] = [];
      const at = state.at!;
      const place = content.places[at]!;
      const doy = dateOf(state.day).doy;
      if (state.ships.length) {
        for (const r of routes(state, content, at)) {
          const short = state.provisions < mouths(state) * r.days;
          out.push(opt('Sail', { t: 'sail', to: r.to }, `Sail to ${content.places[r.to]!.name}`, true, undefined, `About ${r.days} days, ${r.leg.kind === 'open' ? 'open sea' : r.leg.kind}${short ? '. Not enough food' : ''}`));
        }
      } else if (at !== 'home_fjord') out.push(opt('Sail', { t: 'passage_home' }, 'Take passage home on a trader', state.silver >= 12, `You need ${formatSilver(12)}.`, formatSilver(12)));
      if (place.raid) {
        const done = state.seasonRaids.includes(at);
        out.push(opt('Here', { t: 'raid' }, `Raid ${place.name}`, !done && state.crew.men >= 6, done ? 'You raided it this summer already.' : 'You have too few men.'));
      }
      if (at !== 'home_fjord') out.push(opt('Here', { t: 'forage' }, 'Go ashore for cattle and water', true, undefined, 'Food for the crew; the locals may object'));
      out.push(opt('Here', { t: 'rest' }, 'Rest a few days'));
      if (at === 'home_fjord') {
        out.push(...homeActions(state, content));
        out.push(opt('Season', { t: 'end_season' }, 'Haul up the ships for the winter', doy >= LATE_SEASON_DOY, 'Too early: the summer is not done.'));
      } else if (doy >= WINTER_DOY || doy < MUSTER_DOY) out.push(opt('Season', { t: 'winter_here' }, `Winter at ${place.name}`));
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
  if (action.t !== 'slot' && (!allowed || !allowed.enabled)) throw new ActionError(`not available now: ${JSON.stringify(action)}${allowed?.reason ? ' — ' + allowed.reason : ''}`);
  const state = structuredClone(input);
  const rng = new RngCursor(state.rng);
  const report = (title: string, lines: string[], next?: string, art?: { key: string; laughter?: string }) => {
    if (!state.pending && lines.length) state.pending = { t: 'report', title, lines, next, art: art?.key, laughter: art?.laughter };
  };

  switch (action.t) {
    case 'continue': {
      const next = state.pending?.t === 'report' ? state.pending.next : undefined;
      state.pending = null;
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
      const pd = state.pending as Pending | null;
      if (pd) {
        if (text && pd.t === 'duel') pd.duel.log.unshift(text);
        if (text && pd.t === 'battle') pd.battle.log.unshift(text);
      } else if (text) report(scene.title, text.trim().split(/\n\s*\n/), next, typeof scene.art === 'string' ? { key: scene.art } : scene.art);
      else if (next) open(state, next);
      break;
    }
    case 'sail': {
      startVoyage(state, content, action.to);
      const r = runVoyage(state, content, rng);
      report('At sea', r.lines);
      break;
    }
    case 'voyage_on': {
      const r = runVoyage(state, content, rng);
      report('At sea', r.lines);
      break;
    }
    case 'raid':
      startRaid(state, content, rng, state.at!);
      break;
    case 'forage': {
      state.day += 2;
      if (rng.float() < 0.15) {
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
      state.phase = 'return';
      break;
    case 'winter_here':
      report('Winter abroad', winterHere(state));
      break;
    case 'passage_home':
      state.silver -= 12;
      state.day += 12;
      state.at = 'home_fjord';
      report('Home', ['A trader takes you home for silver and a hand at the oars.']);
      break;
    case 'recruit': report('Muster', recruit(state, content)); break;
    case 'provision': report('Muster', provision(state)); break;
    case 'refit': report('Muster', refit(state, content)); break;
    case 'borrow_ship': report('Muster', borrowShip(state)); break;
    case 'set_sail':
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

/** After any action: the season turns if it must, and anything queued fires. */
function settle(state: GameState, content: ContentBundle, rng: RngCursor): void {
  if (!state.hero.alive || state.pending) return;
  const doy = dateOf(state.day).doy;
  if (state.phase === 'sailing' && state.at === 'home_fjord' && !state.voyage && doy >= FORCE_RETURN_DOY) state.phase = 'return';
  trigger(state, content, rng, 'phase_start');
}
