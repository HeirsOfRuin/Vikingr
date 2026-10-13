// Hosts (docs/FRAME-HOSTS-FRISIA.md §Hosts): battles bigger than one crew. The hero's wing is the ordinary
// battle he fights; the other wings of the line fight beside it, round by round, by the same rules
// (battle.ts resolveRound). A broken wing exposes its neighbours; a reserve can be thrown in; what he may order
// depends on his place in the host.
import type { ContentBundle, Order } from '../content/schema';
import type { BattleSide, BattleState, GameState } from './state';
import type { RngCursor } from './rng';
import { adaptivePolicy, doctrinePolicy, resolveRound, type BattlePolicy } from './battle';
import { startBattle } from './fights';

export const HOST = {
  /** Morale a wing loses each round for each neighbour of its own that has broken. */
  flankLoss: 0.5,
  /** Morale the enemy loses each round in a wing whose neighbour we have broken. */
  flankGain: 0.5,
  /** When a wing breaks, this share of the men who broke it turn on the next part of the line. */
  turn: 0.5,
  /** The enemy throws in his reserve when any of his wings falls this low. */
  enemyReserveAt: 4,
  /** A big raid becomes a host when this many defenders stand against a fleet with more than one wing. */
  raidAt: 50,
} as const;

export type HostRole = 'man' | 'wing' | 'host';

export interface HostWing {
  name: string;
  us: BattleSide;
  them: BattleSide;
  over: BattleState['over'];
  killed: number;
  lost: number;
  /** The winners of this wing have turned on the rest of the line. */
  turned?: boolean;
}

export interface HostState {
  title: string;
  wings: HostWing[];
  role: HostRole;
  reserve: { us: number; them: number; usIn: boolean; themIn: boolean };
  /** A signal from the host's leader to the other wings, for the next round. */
  signal?: Order | null;
}

export interface HostWingSpec { name: string; men: number; quality?: number; foe_men: number }

export function startHost(
  state: GameState,
  content: ContentBundle,
  opts: {
    title: string; foe: string; terrain: BattleState['terrain']; context: BattleState['context']; place: string | null;
    foeMen: number; wings: HostWingSpec[]; role?: HostRole; reserve?: { us: number; them: number }; win?: string; lose?: string;
  },
): void {
  startBattle(state, content, { foe: opts.foe, men: opts.foeMen, terrain: opts.terrain, context: opts.context, place: opts.place, win: opts.win, lose: opts.lose, noAlly: true });
  const b = (state.pending as { battle: BattleState }).battle;
  const foe = content.foes[opts.foe]!;
  const role: HostRole = opts.role ?? (state.service ? 'man' : 'wing');
  b.host = {
    title: opts.title,
    role,
    reserve: { us: opts.reserve?.us ?? 0, them: opts.reserve?.them ?? 0, usIn: false, themIn: false },
    wings: opts.wings.map((w) => ({
      name: w.name,
      us: { name: w.name, men: w.men, start: w.men, quality: w.quality ?? 1, morale: 6, doctrine: {}, last: null },
      them: { name: foe.name, men: w.foe_men, start: w.foe_men, quality: foe.quality, morale: 6 + foe.quality, doctrine: foe.doctrine, last: null },
      over: w.men > 0 ? null : 'lost',
      killed: 0,
      lost: 0,
    })),
  };
  const ours = b.us.men + opts.wings.reduce((n, w) => n + w.men, 0);
  const theirs = opts.foeMen + opts.wings.reduce((n, w) => n + w.foe_men, 0);
  b.log.unshift(`${opts.title}. The line is ${ours} strong, against about ${theirs}. ${role === 'host' ? 'The host is yours to command.' : role === 'wing' ? 'You hold your own part of the line.' : 'You stand where you are put.'}`);
  for (const w of b.host.wings) if (w.over === 'lost') b.log.push(`${w.name}: nobody comes. That end of the line is open.`);
}

/** The other wings as a battle the round function understands: no hero in them, no named men. */
function shadow(b: BattleState, w: HostWing): BattleState {
  return {
    foeId: b.foeId, terrain: b.terrain, us: w.us, them: w.them, position: 'wall', round: b.round - 1, log: [],
    heroDown: true, heroHp: 1, heroHpMax: 1, heroArmour: 0, heroHits: [], named: [], deeds: [],
    over: w.over, context: b.context, place: b.place, killed: 0, lost: 0,
  };
}

function weakest(sides: BattleSide[]): BattleSide | undefined {
  return [...sides].sort((a, b) => a.morale - b.morale)[0];
}

/** The flanks: a wing that has broken leaves its neighbours open, and a wing that has broken the enemy turns on his. */
function flank(b: BattleState): void {
  const h = b.host!;
  const lostW = h.wings.filter((w) => w.over === 'lost').length;
  const wonW = h.wings.filter((w) => w.over === 'won').length;
  if (!b.over) {
    b.us.morale -= HOST.flankLoss * lostW;
    b.them.morale -= HOST.flankGain * wonW;
  }
  for (const w of h.wings) {
    if (w.over) continue;
    if (b.over === 'lost') w.us.morale -= HOST.flankLoss;
    if (b.over === 'won') w.them.morale -= HOST.flankGain;
  }
}

/** A wing has broken: half the men who broke it turn on the next part of the line still fighting. */
function turn(b: BattleState): void {
  const h = b.host!;
  for (const w of h.wings) {
    if (!w.over || w.turned || w.over === 'parted') continue;
    w.turned = true;
    if (w.over === 'lost') {
      const n = Math.round(Math.max(0, w.them.men) * HOST.turn);
      const target = !b.over ? b.them : h.wings.find((x) => !x.over)?.them;
      if (n && target) { target.men += n; target.start += n; b.log.push(`${n} of the men who broke ${w.name} come round onto ${target === b.them ? 'your flank' : 'the next part of the line'}.`); }
    } else {
      const n = Math.round(Math.max(0, w.us.men) * HOST.turn);
      const target = !b.over ? b.us : h.wings.find((x) => !x.over)?.us;
      if (n && target) {
        target.men += n;
        target.start += n;
        if (target === b.us) b.allyMen = (b.allyMen ?? 0) + n;
        b.log.push(`${n} of ${w.name} come round onto their flank${target === b.us ? ', beside you' : ''}.`);
      }
    }
  }
}

/** One round of the whole line. */
export function hostRound(b: BattleState, ours: Order, rng: RngCursor, policy: BattlePolicy = adaptivePolicy): BattleState {
  const h = b.host!;
  turn(b);
  flank(b);
  // the enemy throws in his reserve when a wing of his is going
  if (!h.reserve.themIn && h.reserve.them > 0) {
    const sides = [b.over ? null : b.them, ...h.wings.filter((w) => !w.over).map((w) => w.them)].filter((x): x is BattleSide => !!x);
    const low = weakest(sides);
    if (low && low.morale <= HOST.enemyReserveAt) {
      low.men += h.reserve.them;
      low.start += h.reserve.them;
      low.morale += 2;
      h.reserve.themIn = true;
      b.log.push(`Their reserve comes down the slope at a run, ${h.reserve.them} fresh men, into the part of their line that was going.`);
    }
  }
  if (!b.over) resolveRound(b, ours, doctrinePolicy(b, 'them', rng), rng);
  for (const w of h.wings) {
    if (w.over) continue;
    const sb = shadow(b, w);
    resolveRound(sb, h.signal ?? policy(sb, 'us', rng), doctrinePolicy(sb, 'them', rng), rng);
    w.over = sb.over;
    w.killed += sb.killed;
    w.lost += sb.lost;
    if (w.over === 'won') b.log.push(`On the flank, ${w.name} break the men in front of them and turn on the rest.`);
    else if (w.over === 'lost') b.log.push(`On the flank, ${w.name} break and run. That end of the line is open.`);
    else if (w.over === 'parted') b.log.push(`On the flank, ${w.name} and the men facing them fall back from each other, spent.`);
  }
  h.signal = null;
  if (b.over) settleHost(b, rng, policy);
  return b;
}

/** The hero's wing is done: the rest of the line fights to its end, and the field goes to whoever holds more of it. */
function settleHost(b: BattleState, rng: RngCursor, policy: BattlePolicy): void {
  const h = b.host!;
  for (let guard = 0; guard < 40 && h.wings.some((w) => !w.over); guard++) {
    b.round += 1;
    turn(b);
    flank(b);
    for (const w of h.wings) {
      if (w.over) continue;
      const sb = shadow(b, w);
      resolveRound(sb, policy(sb, 'us', rng), doctrinePolicy(sb, 'them', rng), rng);
      w.over = sb.over ?? (guard === 39 ? 'parted' : null);
      w.killed += sb.killed;
      w.lost += sb.lost;
    }
  }
  // an empty wing (nobody came) is not a wing that broke: the field goes by the wings that fought
  const score = [b.over, ...h.wings.filter((w) => w.us.start > 0).map((w) => w.over)].reduce((n, o) => n + (o === 'won' ? 1 : o === 'lost' ? -1 : 0), 0);
  const mine = b.over;
  b.over = score > 0 ? 'won' : score < 0 ? 'lost' : 'parted';
  if (mine === 'lost' && b.over === 'won') b.log.push('Your part of the line broke. But the host held, and it is the host that takes the field.');
  else if (mine === 'won' && b.over === 'lost') b.log.push('Your part of the line held, and more. But the rest of the host broke, and you have to go back with it, step by step, to the ships.');
  else if (b.over === 'won') b.log.push('The whole line goes forward, and the field is yours.');
  else if (b.over === 'lost') b.log.push('The whole line breaks for the ships.');
  else b.log.push('The two hosts draw apart, too spent to go on, and neither holds the field.');
}

export function fightOutHost(b: BattleState, ourPolicy: BattlePolicy, rng: RngCursor): BattleState {
  for (let guard = 0; guard < 60 && !(b.over && b.host!.wings.every((w) => w.over)); guard++) {
    if (b.over) { settleHost(b, rng, ourPolicy); break; }
    hostRound(b, ourPolicy(b, 'us', rng), rng, ourPolicy);
  }
  return b;
}

/** The host's leader throws in his reserve: to whichever of his wings is closest to breaking. */
export function commitReserve(b: BattleState): void {
  const h = b.host!;
  if (h.reserve.usIn || h.reserve.us <= 0) return;
  const sides = [b.over ? null : b.us, ...h.wings.filter((w) => !w.over).map((w) => w.us)].filter((x): x is BattleSide => !!x);
  const low = weakest(sides);
  if (!low) return;
  low.men += h.reserve.us;
  low.start += h.reserve.us;
  low.morale += 2;
  h.reserve.usIn = true;
  // the reserve isn't his crew: what it loses is its own (fights.ts finishBattle)
  if (low === b.us) b.allyMen = (b.allyMen ?? 0) + h.reserve.us;
  b.log.push(`You throw in the reserve: ${h.reserve.us} men behind ${low === b.us ? 'your own part of the line' : low.name}.`);
}
