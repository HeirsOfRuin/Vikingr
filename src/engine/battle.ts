// The shield-wall (DESIGN §11.2). Rounds: each side picks an order; orders
// counter each other; men fall and morale breaks. Pure: (battle, orders, rng) -> battle.
// A battle fought by hand, "let the men handle it", and tools/measure-battle.ts
// all go through resolveRound().
import type { BattleTerrain, Order } from '../content/schema';
import { ORDERS } from '../content/schema';
import type { BattleSide, BattleState, Position } from './state';
import type { RngCursor } from './rng';
import { BATTLE, QUALITY_GUARD, QUALITY_MULT } from './tuning';

/** Advantage of the row order over the column order. Antisymmetric: M[a][b] = -M[b][a]. */
export const MATCHUP: Record<Order, Record<Order, number>> = {
  hold: { hold: 0, push: 1, missiles: -1, wedge: -1, give: 0, flank: 1 },
  push: { hold: -1, push: 0, missiles: 1, wedge: -1, give: -1, flank: 1 },
  missiles: { hold: 1, push: -1, missiles: 0, wedge: 1, give: 0, flank: -1 },
  wedge: { hold: 1, push: 1, missiles: -1, wedge: 0, give: -1, flank: -1 },
  give: { hold: 0, push: 1, missiles: 0, wedge: 1, give: 0, flank: -1 },
  flank: { hold: -1, push: -1, missiles: 1, wedge: 1, give: 1, flank: 0 },
};

/** How hard an order hits (out) and how exposed it leaves the men (in). */
export const INTENSITY: Record<Order, { out: number; in: number }> = {
  hold: { out: 0.8, in: 0.8 },
  push: { out: 1.2, in: 1.2 },
  missiles: { out: 0.7, in: 0.6 },
  wedge: { out: 1.5, in: 1.4 },
  give: { out: 0.5, in: 0.7 },
  flank: { out: 1.1, in: 1.0 },
};

export const ORDER_NAMES: Record<Order, string> = {
  hold: 'Hold the wall',
  push: 'Push',
  missiles: 'Throw spears and stones',
  wedge: 'Swine-array (wedge)',
  give: 'Give ground',
  flank: 'Go round their flank',
};

export const POSITION_NAMES: Record<Position, string> = { front: 'Front rank', wall: 'In the wall', rear: 'Behind the wall' };

/** Terrain multipliers on an order's blows. `defender` applies to the side holding the place. */
function terrainMult(t: BattleTerrain, o: Order, defender: boolean): number {
  switch (t) {
    case 'ford': return o === 'push' || o === 'wedge' ? 0.7 : 1;
    case 'rampart': return defender ? (o === 'hold' || o === 'missiles' ? 1.3 : 1) : o === 'missiles' ? 0.7 : 1;
    case 'ship': return o === 'push' ? 1.1 : 1;
    case 'woods': return o === 'missiles' ? 0.6 : o === 'flank' ? 1.2 : 1;
    case 'field': return o === 'flank' ? 1.2 : 1;
    default: return 1;
  }
}

export function availableOrders(b: BattleState, side: 'us' | 'them'): Order[] {
  const me = side === 'us' ? b.us : b.them;
  const other = side === 'us' ? b.them : b.us;
  return ORDERS.filter((o) => {
    if (o === 'flank') return me.men >= other.men * BATTLE.flankRatio && !['ship', 'ford', 'rampart'].includes(b.terrain);
    if (o === 'give') return b.terrain !== 'ship';
    return true;
  });
}

function lerp(table: readonly number[], q: number): number {
  const lo = Math.max(0, Math.min(3, Math.floor(q)));
  const hi = Math.min(3, lo + 1);
  return table[lo]! + (table[hi]! - table[lo]!) * (Math.min(3, q) - lo);
}
export const qualityMult = (q: number) => lerp(QUALITY_MULT, q);
export const qualityGuard = (q: number) => lerp(QUALITY_GUARD, q);

function moraleFactor(s: BattleSide): number {
  return 0.75 + (Math.max(0, s.morale) / 10) * 0.5;
}

// ---- policies ----

export type BattlePolicy = (b: BattleState, side: 'us' | 'them', rng: RngCursor) => Order;

export const doctrinePolicy: BattlePolicy = (b, side, rng) => {
  const me = side === 'us' ? b.us : b.them;
  const ok = availableOrders(b, side);
  return rng.pickWeighted(ok, (o) => (me.doctrine[o] ?? 0.2) + 0.02)!;
};

/** The enemy's likely orders as the hero sees them. Behind the wall he sees the field; in the front rank he sees a shield. */
export function enemyForecast(b: BattleState): Record<Order, number> {
  const ok = availableOrders(b, 'them');
  const clarity = b.position === 'rear' ? 1 : b.position === 'wall' ? 0.7 : 0.45;
  const out = {} as Record<Order, number>;
  let total = 0;
  for (const o of ORDERS) total += ok.includes(o) ? (b.them.doctrine[o] ?? 0.2) + 0.02 : 0;
  for (const o of ORDERS) {
    const truth = ok.includes(o) ? ((b.them.doctrine[o] ?? 0.2) + 0.02) / total : 0;
    out[o] = ok.includes(o) ? truth * clarity + (1 - clarity) / ok.length : 0;
  }
  return out;
}

/** Leading the wall: pick the order with the best expected exchange of losses, as a share of each side.
 *  Used by "let the men handle it" and the bot. */
export const adaptivePolicy: BattlePolicy = (b, side, rng) => {
  if (side === 'them') return doctrinePolicy(b, side, rng);
  const fc = enemyForecast(b);
  const ok = availableOrders(b, 'us');
  const pUs = b.us.men * qualityMult(b.us.quality) * moraleFactor(b.us);
  const pThem = b.them.men * qualityMult(b.them.quality) * moraleFactor(b.them);
  let best: Order = 'hold';
  let bestV = -Infinity;
  for (const o of ok) {
    let v = rng.float() * 0.02;
    for (const e of ORDERS) {
      if (!fc[e]) continue;
      const dealt = pUs * INTENSITY[o].out * INTENSITY[e].in * (1 + BATTLE.matchupStep * MATCHUP[o][e]) * qualityGuard(b.them.quality);
      const taken = pThem * INTENSITY[e].out * INTENSITY[o].in * (1 + BATTLE.matchupStep * MATCHUP[e][o]) * qualityGuard(b.us.quality);
      // score in morale, which is what breaks a wall: losses as a share of the start, and the cost of the wrong call
      const theirLoss = (BATTLE.moraleFromLosses * BATTLE.k * dealt) / Math.max(1, b.them.start) + matchMorale(MATCHUP[e][o], e);
      const ourLoss = (BATTLE.moraleFromLosses * BATTLE.k * taken) / Math.max(1, b.us.start) + matchMorale(MATCHUP[o][e], o);
      v += fc[e] * (theirLoss * (1.15 - 0.15 * b.them.quality) - ourLoss * (1.15 - 0.15 * b.us.quality));
    }
    if (v > bestV) { bestV = v; best = o; }
  }
  return best;
};

function matchMorale(mu: number, mine: Order): number {
  return (mu < 0 ? BATTLE.moraleFromMatchup : mu > 0 ? -0.2 : 0) + (mine === 'give' ? BATTLE.giveGroundMorale : 0);
}

// ---- resolution ----

function blows(att: BattleSide, def: BattleSide, oa: Order, od: Order, b: BattleState, attIsUs: boolean, rng: RngCursor): number {
  const defenderHolds = b.context === 'raid' ? !attIsUs : false;
  let power = att.men * qualityMult(att.quality) * moraleFactor(att) * terrainMult(b.terrain, oa, defenderHolds);
  if (attIsUs && !b.heroDown) {
    power *= BATTLE.heroPower[b.position];
    const hs = b.heroSkill;
    if (hs) power *= (1 + BATTLE.skill.weaponsStep * (hs.weapons - 2) * BATTLE.skill.weaponsAt[b.position]) * (1 + commandBonus(b));
  }
  const m = 1 + BATTLE.matchupStep * MATCHUP[oa][od];
  const raw = BATTLE.k * power * m * INTENSITY[oa].out * INTENSITY[od].in * qualityGuard(def.quality) * (0.75 + rng.float() * 0.5);
  return Math.min(def.men, Math.round(raw));
}

/** What his command is worth to the line he leads: more blows, steadier men. Nothing if he is down or only an oarsman. */
export function commandBonus(b: BattleState): number {
  const hs = b.heroSkill;
  if (!hs || !hs.leads || b.heroDown) return 0;
  return Math.min(BATTLE.skill.commandMax, Math.max(0, BATTLE.skill.commandStep * (hs.command - 1)));
}

function loseMorale(s: BattleSide, cas: number, mine: Order, theirs: Order, mult: number) {
  const loss = (BATTLE.moraleFromLosses * cas) / Math.max(1, s.start) + matchMorale(MATCHUP[mine][theirs], mine);
  // seasoned men take losses better than green ones
  s.morale = Math.min(10, s.morale - loss * mult * (1.15 - 0.15 * s.quality));
}

function broken(s: BattleSide): boolean {
  return s.morale <= BATTLE.breakMorale || s.men <= s.start * BATTLE.breakStrength;
}

/** One round. Mutates and returns the battle (callers pass a copy). */
export function resolveRound(b: BattleState, ours: Order, theirs: Order, rng: RngCursor): BattleState {
  if (b.over) return b;
  b.round += 1;
  const toThem = blows(b.us, b.them, ours, theirs, b, true, rng);
  const toUs = blows(b.them, b.us, theirs, ours, b, false, rng);
  b.them.men -= toThem;
  b.us.men -= toUs;
  b.killed += toThem;
  b.lost += toUs;
  loseMorale(b.them, toThem, theirs, ours, 1);
  loseMorale(b.us, toUs, ours, theirs, (b.heroDown ? 1 : BATTLE.heroMoraleLoss[b.position]) * (1 - commandBonus(b)));
  b.us.last = ours;
  b.them.last = theirs;
  const mu = MATCHUP[ours][theirs];
  b.log.push(`Round ${b.round}: ${ORDER_NAMES[ours].toLowerCase()} against ${ORDER_NAMES[theirs].toLowerCase()}${mu > 0 ? ' — it works' : mu < 0 ? ' — the wrong call' : ''}. They lose ${toThem}, you lose ${toUs}.`);

  // the hero in the press
  const exposure = INTENSITY[ours].in * Math.min(2, Math.max(0.5, (b.them.men + toThem) / Math.max(1, b.us.men + toUs)));
  const guard = b.heroSkill ? Math.min(BATTLE.skill.shieldMax, Math.max(BATTLE.skill.shieldMin, 1 - BATTLE.skill.shieldStep * (b.heroSkill.shield - 2))) : 1;
  if (!b.heroDown && rng.float() < BATTLE.heroHit[b.position] * exposure * guard) {
    const dmg = Math.max(1, 3 + rng.int(7) + Math.round(b.them.quality) - b.heroArmour);
    b.heroHp -= dmg;
    b.heroHits.push(dmg);
    if (b.heroHp <= 0) {
      b.heroDown = true;
      b.us.morale -= BATTLE.heroDownMorale;
      b.log.push('You go down. Someone drags you back behind the shields by your belt.');
    } else b.log.push(`A blade finds you (${dmg}).`);
  }
  // the named men beside him
  for (const n of b.named) {
    if (n.down) continue;
    const slot = n.slot;
    if (rng.float() < BATTLE.manHit[slot] * exposure) {
      if (rng.float() < BATTLE.manHitDeath) {
        n.down = true;
        b.log.push(`${n.name} falls.`);
      } else if (!n.hurt) {
        n.hurt = true;
        b.log.push(`${n.name} is hurt, and keeps his place.`);
      }
    } else if (mu > 0 && slot === 'front' && rng.float() < 0.12) {
      b.deeds.push({ type: 'man_deed', text: `${n.name} broke their shield-wall`, who: n.id });
      b.log.push(`${n.name} breaks a man's shield and the man behind it.`);
    }
  }
  if (!b.heroDown && b.position === 'front' && mu > 0 && rng.float() < 0.15 + (b.heroSkill ? BATTLE.skill.deedStep * (b.heroSkill.weapons - 2) : 0)) {
    b.deeds.push({ type: 'front_deed', text: `Cut his way through their front rank`, who: null });
    b.log.push('You are through their front rank, and they know your face now.');
  }

  const usBroken = broken(b.us);
  const themBroken = broken(b.them);
  if (themBroken && !usBroken) {
    const chase = Math.round(b.them.men * BATTLE.routPursuit * (theirs === 'give' ? 0.5 : 1));
    b.them.men -= chase;
    b.killed += chase;
    b.over = 'won';
    b.log.push(`They break. You cut down ${chase} more as they run.`);
  } else if (usBroken) {
    const chase = Math.round(b.us.men * BATTLE.routPursuit * (ours === 'give' ? 0.5 : 1));
    b.us.men -= chase;
    b.lost += chase;
    b.over = 'lost';
    b.log.push(`Your men break for the ships. ${chase} more are cut down from behind.`);
  } else if (b.round >= BATTLE.maxRounds) {
    b.over = 'parted';
    b.log.push('Both walls fall back, spent. Neither side has the strength to go again today.');
  }
  return b;
}

export function fightOutBattle(b: BattleState, ourPolicy: BattlePolicy, rng: RngCursor): BattleState {
  while (!b.over) resolveRound(b, ourPolicy(b, 'us', rng), doctrinePolicy(b, 'them', rng), rng);
  return b;
}
