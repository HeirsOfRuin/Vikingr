// Single combat (DESIGN §11.1). Exchanges: both fighters choose one of five
// moves; each move beats two and loses to two. Pure: (duel, moves, rng) -> duel.
// A duel fought by hand, fought "on instinct" and run by tools/measure-duel.ts
// all go through resolveExchange().
import type { DuelMove, Fighter } from '../content/schema';
import { DUEL_MOVES } from '../content/schema';
import type { DuelSide, DuelState } from './state';
import type { RngCursor } from './rng';
import { DUEL } from './tuning';

/** What each move beats. Each beats two and loses to two. */
export const BEATS: Record<DuelMove, readonly DuelMove[]> = {
  strike: ['feint', 'bash'],
  guard: ['strike', 'bind'],
  feint: ['guard', 'bash'],
  bind: ['strike', 'feint'],
  bash: ['guard', 'bind'],
};

export function matchup(a: DuelMove, b: DuelMove): 1 | 0 | -1 {
  if (a === b) return 0;
  return BEATS[a].includes(b) ? 1 : -1;
}

export const MOVE_NAMES: Record<DuelMove, string> = { strike: 'Strike', guard: 'Guard', feint: 'Feint', bind: 'Bind', bash: 'Shield-bash' };

export function sideFromFighter(f: Fighter, kind: DuelState['kind']): DuelSide {
  const hpMax = 10 + 2 * f.attrs.end;
  const staminaMax = 6 + f.attrs.end;
  return {
    name: f.name,
    hp: hpMax,
    hpMax,
    stamina: staminaMax,
    staminaMax,
    shields: kind === 'holmgang' ? DUEL.holmgangShields : 1,
    integrity: kind === 'holmgang' ? DUEL.holmgangShieldIntegrity : DUEL.shieldIntegrity,
    str: f.attrs.str,
    agi: f.attrs.agi,
    weapons: f.weapons,
    shield: f.shield,
    armour: f.armour,
    weapon: f.weapon,
    habits: f.habits,
    bled: false,
    hits: [],
  };
}

export function makeDuel(kind: DuelState['kind'], lethal: boolean, foeId: string, hero: DuelSide, foe: DuelSide, readChance: number): DuelState {
  return { kind, lethal, foeId, hero, foe, exchange: 0, seen: {}, read: [], readChance, log: [], over: null };
}

export function canYield(d: DuelState): boolean {
  return d.over === null && d.kind === 'holmgang' && d.hero.bled;
}

// ---- policies ----

/** Weights a fighter's habits by his state: tired men guard, and nobody bashes with a broken shield. */
function situational(me: DuelSide, base: Partial<Record<DuelMove, number>>): Record<DuelMove, number> {
  const w = {} as Record<DuelMove, number>;
  for (const m of DUEL_MOVES) w[m] = (base[m] ?? 1) + 0.05;
  if (me.stamina <= 2) w.guard *= 3;
  if (me.shields <= 0) {
    w.bash = 0.01;
    w.guard *= 0.5;
  }
  return w;
}

export type DuelPolicy = (d: DuelState, side: 'hero' | 'foe', rng: RngCursor) => DuelMove;

/** Plays his habits. A skilled fighter also reads the hero back: he counters what the hero keeps doing. */
export const habitPolicy: DuelPolicy = (d, side, rng) => {
  const me = side === 'hero' ? d.hero : d.foe;
  if (side === 'foe' && me.weapons >= 3 && d.exchange >= 2) {
    const reads = (me.weapons - 2) * 0.15; // weapons 3: 15%, 4: 30%, 5: 45%
    if (rng.float() < reads) {
      const heroSeen = d.heroSeen ?? {};
      const fav = DUEL_MOVES.reduce((a, m) => ((heroSeen[m] ?? 0) > (heroSeen[a] ?? 0) ? m : a), 'strike' as DuelMove);
      const counters = DUEL_MOVES.filter((m) => BEATS[m].includes(fav) && !(m === 'bash' && me.shields <= 0));
      if (counters.length) return counters[rng.int(counters.length)]!;
    }
  }
  const w = situational(me, me.habits);
  return rng.pickWeighted([...DUEL_MOVES], (m) => w[m])!;
};

/** The foe's likely moves as the hero sees them: what he has read, what he has seen, and his own guess. */
export function foeForecast(d: DuelState): Record<DuelMove, number> {
  const prior = {} as Record<DuelMove, number>;
  const habits = situational(d.foe, d.foe.habits);
  const total = DUEL_MOVES.reduce((s, m) => s + habits[m], 0);
  for (const m of DUEL_MOVES) {
    // a read habit is known; an unread one is a guess, and only what he has done so far shifts it
    const known = d.read.includes(m) ? habits[m] / total : 0.2;
    prior[m] = known * (d.read.includes(m) ? 8 : 2) + (d.seen[m] ?? 0) * 0.5;
  }
  const s = DUEL_MOVES.reduce((a, m) => a + prior[m], 0);
  for (const m of DUEL_MOVES) prior[m] /= s;
  return prior;
}

/** Roughly what winning an exchange with each move is worth (damage, stamina, shield). */
const WIN_VALUE: Record<DuelMove, number> = { strike: 5, feint: 3.5, bind: 2.5, bash: 2, guard: 1.5 };

/** Fighting on instinct: counter what he expects, with some noise. Used by "let instinct take it" and the bot. */
export const adaptivePolicy: DuelPolicy = (d, side, rng) => {
  if (side === 'foe') return habitPolicy(d, side, rng);
  // instinct is decent, not perfect: a careful player reading the fight should beat it
  if (rng.float() < 0.3) return DUEL_MOVES[rng.int(DUEL_MOVES.length)]!;
  const fc = foeForecast(d);
  let best: DuelMove = 'guard';
  let bestV = -Infinity;
  for (const m of DUEL_MOVES) {
    let v = 0;
    for (const o of DUEL_MOVES) {
      const r = matchup(m, o);
      v += fc[o] * (r > 0 ? WIN_VALUE[m] : r < 0 ? -WIN_VALUE[o] : 0);
    }
    if (d.hero.stamina < (DUEL.cost[m] ?? 0)) v -= 1.5;
    if (m === 'bash' && d.hero.shields <= 0) v -= 5;
    if (v > bestV) { bestV = v; best = m; }
  }
  return best;
};

// ---- resolution ----

function quality(w: DuelSide, l: DuelSide, skillW: number, skillL: number): number {
  const exhausted = w.stamina < 0 ? DUEL.exhaustedPenalty : 0;
  const p = DUEL.baseQuality + DUEL.skillStep * (skillW - skillL) + DUEL.agiStep * (w.agi - l.agi) - exhausted;
  return Math.min(DUEL.qualityMax, Math.max(DUEL.qualityMin, p));
}

function hit(target: DuelSide, dmg: number): number {
  const d = Math.max(0, Math.round(dmg));
  if (d > 0) {
    target.hp -= d;
    target.bled = true;
    target.hits.push(d);
  }
  return d;
}

function damageShield(s: DuelSide, n: number, kind: DuelState['kind']): boolean {
  if (s.shields <= 0) return false;
  s.integrity -= n;
  if (s.integrity <= 0) {
    s.shields -= 1;
    s.integrity = s.shields > 0 ? (kind === 'holmgang' ? DUEL.holmgangShieldIntegrity : DUEL.shieldIntegrity) : 0;
    return true;
  }
  return false;
}

function pay(s: DuelSide, m: DuelMove) {
  s.stamina = Math.min(s.staminaMax, s.stamina - (DUEL.cost[m] ?? 0));
}

/** One side's winning move against the other. Returns a line for the log. */
function apply(d: DuelState, wSide: 'hero' | 'foe', mw: DuelMove, ml: DuelMove, rng: RngCursor): string {
  const w = wSide === 'hero' ? d.hero : d.foe;
  const l = wSide === 'hero' ? d.foe : d.hero;
  const you = wSide === 'hero';
  const W = you ? 'You' : l === d.hero ? w.name : 'He';
  const q = rng.float() < quality(w, l, mw === 'guard' ? w.shield : w.weapons, ml === 'guard' ? l.shield : l.weapons);
  switch (mw) {
    case 'strike': {
      const base = 3 + w.str + w.weapon - l.armour + rng.int(3);
      const dmg = hit(l, q ? base : base / 2);
      return `${W} ${you ? 'catch' : 'catches'} the ${ml === 'feint' ? 'feint' : 'shield-rush'} with a ${q ? 'clean' : 'glancing'} blow (${dmg}).`;
    }
    case 'feint': {
      if (!q) {
        l.stamina -= 1;
        return `${W} ${you ? 'draw' : 'draws'} the ${ml === 'guard' ? 'guard' : 'rush'} wide, but the cut that follows is late.`;
      }
      const dmg = hit(l, 2 + w.weapon + rng.int(2) - Math.floor(l.armour / 2));
      return `${W} ${you ? 'draw' : 'draws'} the ${ml === 'guard' ? 'guard' : 'rush'} wide and ${you ? 'cut' : 'cuts'} in behind it (${dmg}).`;
    }
    case 'bind': {
      l.stamina -= 2;
      if (!q) return `${W} ${you ? 'hook' : 'hooks'} the ${ml === 'strike' ? 'blade' : 'shield'} and ${you ? 'hold' : 'holds'} it, breathing hard.`;
      const dmg = hit(l, 2 + rng.int(2));
      return `${W} ${you ? 'hook' : 'hooks'} the ${ml === 'strike' ? 'blade' : 'shield'} aside and ${you ? 'hammer' : 'hammers'} the pommel home (${dmg}).`;
    }
    case 'bash': {
      const broke = damageShield(l, 2, d.kind);
      l.stamina -= 2;
      const dmg = q ? hit(l, 1 + rng.int(2)) : 0;
      return `${W} ${you ? 'drive' : 'drives'} the shield-boss into the ${ml === 'guard' ? 'guard' : 'bind'}${broke ? ', and the shield splits' : ''}${dmg ? ` (${dmg})` : ''}.`;
    }
    case 'guard': {
      if (w.shields <= 0 && rng.float() > DUEL.noShieldGuard) {
        const dmg = hit(w, (3 + l.str + l.weapon - w.armour) / 2);
        return `${W} ${you ? 'have' : 'has'} no shield left; the parry is not enough (${dmg} to ${you ? 'you' : 'him'}).`;
      }
      const broke = ml === 'strike' ? damageShield(w, 1, d.kind) : false;
      l.stamina -= 1;
      const dmg = q ? hit(l, 1 + rng.int(3)) : 0;
      return `${W} ${you ? 'take' : 'takes'} it on the shield${broke ? ', which splits' : ''}${dmg ? ` and ${you ? 'answer' : 'answers'} with a cut (${dmg})` : ''}.`;
    }
  }
}

function tie(d: DuelState, m: DuelMove, rng: RngCursor): string {
  switch (m) {
    case 'strike': {
      const pH = 0.5 + 0.06 * (d.hero.weapons - d.foe.weapons);
      const a = rng.float() < pH ? hit(d.foe, (3 + d.hero.str + d.hero.weapon - d.foe.armour) / 2) : 0;
      const b = rng.float() < 1 - pH ? hit(d.hero, (3 + d.foe.str + d.foe.weapon - d.hero.armour) / 2) : 0;
      return `Blow for blow${a ? `: you land one (${a})` : ''}${b ? `${a ? ' and' : ':'} he lands one (${b})` : ''}${!a && !b ? ', steel on steel' : ''}.`;
    }
    case 'bash': {
      damageShield(d.hero, 1, d.kind);
      damageShield(d.foe, 1, d.kind);
      return 'Shield meets shield with a crack. Both of you stagger.';
    }
    case 'guard': return 'Both of you hold back behind your shields and breathe.';
    case 'feint': return 'Two feints, and nothing behind either.';
    case 'bind': return 'Blades locked, you shove and grunt and break apart.';
  }
}

function maybeRead(d: DuelState, rng: RngCursor) {
  if (rng.float() >= d.readChance) return;
  const habits = situational(d.foe, d.foe.habits);
  const unread = DUEL_MOVES.filter((m) => !d.read.includes(m)).sort((a, b) => habits[b] - habits[a]);
  if (unread[0]) {
    d.read.push(unread[0]);
    d.log.push(`You read him: he leans on the ${MOVE_NAMES[unread[0]].toLowerCase()}.`);
  }
}

/** One exchange. Mutates and returns the duel (callers pass a copy). */
export function resolveExchange(d: DuelState, heroMove: DuelMove, foeMove: DuelMove, rng: RngCursor): DuelState {
  if (d.over) return d;
  d.exchange += 1;
  d.seen[foeMove] = (d.seen[foeMove] ?? 0) + 1;
  d.heroSeen = d.heroSeen ?? {};
  d.heroSeen[heroMove] = (d.heroSeen[heroMove] ?? 0) + 1;
  pay(d.hero, heroMove);
  pay(d.foe, foeMove);
  const r = matchup(heroMove, foeMove);
  const line = r === 0 ? tie(d, heroMove, rng) : r > 0 ? apply(d, 'hero', heroMove, foeMove, rng) : apply(d, 'foe', foeMove, heroMove, rng);
  d.log.push(`${MOVE_NAMES[heroMove]} against ${MOVE_NAMES[foeMove].toLowerCase()}. ${line}`);
  maybeRead(d, rng);

  if (d.foe.hp <= 0) d.over = 'won';
  else if (d.hero.hp <= 0) d.over = 'lost';
  else if (d.kind === 'holmgang' && d.foe.bled && d.foe.hp < d.foe.hpMax / 2 && rng.float() < 0.35) {
    d.over = 'foe_yielded';
    d.log.push(`${d.foe.name} steps off the cloak and throws down his sword. He will pay the holmlausn.`);
  } else if (d.exchange >= DUEL.maxExchanges) {
    d.over = 'parted';
    d.log.push('Neither of you can lift an arm. The onlookers pull you apart.');
  }
  return d;
}

/** Instinct stops once, in a holmgang, when he is bleeding badly: whether to yield is the player's call. */
export function shouldPause(d: DuelState): boolean {
  return !d.paused && canYield(d) && d.hero.hp < d.hero.hpMax * 0.35;
}

/** Plays a duel to the end (or to a pause) with the given hero policy. For auto-resolve and measurement. */
export function fightOut(d: DuelState, heroPolicy: DuelPolicy, rng: RngCursor, pause = false): DuelState {
  while (!d.over) {
    if (pause && shouldPause(d)) {
      d.paused = true;
      d.log.push('Your blood is on the cloak, and your arm is slowing. You could still step off.');
      break;
    }
    resolveExchange(d, heroPolicy(d, 'hero', rng), habitPolicy(d, 'foe', rng), rng);
  }
  return d;
}
