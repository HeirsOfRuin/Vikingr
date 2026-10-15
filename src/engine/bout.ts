// Single combat, second form (docs/FRAME-COMBAT-2.md). Each exchange the other man shows what he is about to do;
// you answer. What decides it is what you can afford: stamina (a great blow costs three), shields (they split),
// and on the holmgang cloak, ground (step off it and you have run). Chance moves the damage a little; it does not
// decide what beats what. Lives inside the old DuelState (d.bout), so wounds, yielding and the story links stay.
// Revision 2 (the author: "it reveals too much"): a cunning man is only likely to do what he seems to, or could be
// doing one of two things; the moves no longer show what they will do this exchange.
import type { DuelSide, DuelState } from './state';
import type { RngCursor } from './rng';
import { readRoll, type Read } from './wall';

export type BoutMove = 'heavy' | 'quick' | 'guard' | 'bash' | 'back';
export const BOUT_MOVES: BoutMove[] = ['heavy', 'quick', 'guard', 'bash', 'back'];

export interface BoutState {
  foeIntent: BoutMove;
  /** What he means to do after that, if the hero can read him that far. */
  foeNext: BoutMove | null;
  heroOff: boolean;
  foeOff: boolean;
  /** Steps back toward the edge of the cloak (holmgang): at 3 he is off it. */
  heroEdge: number;
  foeEdge: number;
  /** The hero reads him two moves ahead: wits and cunning. */
  readsAhead: boolean;
  /** What the hero sees of his next move, and how sure he is. */
  read: Read;
  shown: BoutMove[];
  readScore: number;
  guile: number;
  /** Who shouts advice from the edge of the cloak while he is new to this; null once he knows it. */
  adviser: string | null;
}

export const BOUT = {
  /** Wits and cunning together at or above this: he reads his man two moves ahead. */
  readAhead: 6,
  cost: { heavy: 3, quick: 1, guard: -1, bash: 2, back: -3 } as Record<BoutMove, number>,
  edge: 3,
  maxExchanges: 16,
  shieldHeavy: 2,
  shieldBash: 1,
  offBalanceTaken: 1.5,
  offBalanceDealt: 0.5,
  tired: 2,
  tiredDealt: 0.6,
  bareGuard: 0.5,
  /** A shield raised by a man still off his line (before the off-balance multiplier). */
  lateGuard: 0.35,
  /** Rushing a stronger man's great blow: you still knock him off his line, and still take this much of it. */
  biggerMan: 0.5,
  /** Fighting on instinct: the chance an exchange goes to habit (a great blow) instead of the right answer, less per weapons point. */
  instinctSlip: 0.4,
  instinctSkill: 0.06,
  instinctFloor: 0.15,
};

export const MOVE_LABEL: Record<BoutMove, string> = { heavy: 'Great blow', quick: 'Quick cut', guard: 'Shield up', bash: 'Shield rush', back: 'Step back' };
export const FOE_NEXT: Record<BoutMove, string> = {
  heavy: 'swing a great blow', quick: 'look for a quick cut', guard: 'put his shield up and wait', bash: 'rush you behind his shield', back: 'step back for breath',
};
export const FOE_TELL: Record<BoutMove, string> = {
  heavy: 'draws back for a great overhand blow',
  quick: 'is looking for a quick cut at your arm',
  guard: 'raises his shield and waits',
  bash: 'drops his shoulder behind his shield to rush you',
  back: 'is giving ground, to get his breath',
};

/** What a cunning man's move can be mistaken for. */
const DECOY: Record<BoutMove, BoutMove> = { heavy: 'quick', quick: 'heavy', guard: 'bash', bash: 'heavy', back: 'guard' };

/** What a move says on its button: what it does and costs, nothing about this exchange. */
export function moveDesc(d: DuelState, m: BoutMove): string {
  switch (m) {
    case 'heavy': return 'A great overhand blow. −3 breath';
    case 'quick': return 'A fast cut. −1 breath';
    case 'guard': return 'Shield up, and wait. +1 breath';
    case 'bash': return 'Drive in behind your shield. −2 breath';
    case 'back': return d.kind === 'holmgang' ? 'Give ground for breath. +3 breath; a step toward the edge' : 'Give ground for breath. +3 breath';
  }
}
export const BOUT_ADVICE: Record<BoutMove, string> = {
  heavy: 'Now! Hit him!',
  quick: 'Cut him as he comes!',
  guard: 'On the rim! Take it on the rim!',
  bash: 'Get inside it! Shoulder him!',
  back: 'Give him room! Get your breath!',
};
export const BOUT_WAYS: string[] = [
  'A raised shield takes a great blow, but the board splits.',
  'A shield rush beats a great blow and a raised shield. A quick cut slips it.',
  'A quick cut beats a rush and a man stepping back. A great blow beats a quick cut.',
  'A man knocked off his line gets his shield up late: that is when the great blow goes through.',
  'Rush a bigger man\'s blow and you still take some of it.',
  'Step back for breath. Three steps on the cloak and you have run.',
];

function heavyDmg(s: DuelSide): number { return 3 + s.str + s.weapon + Math.floor(s.weapons / 2); }
function quickDmg(s: DuelSide): number { return 1 + Math.floor(s.agi / 2) + Math.floor(s.weapons / 3); }
function bashDmg(s: DuelSide): number { return 1 + Math.floor(s.str / 2); }

interface Meet { toFoe: number; toHero: number; foeShield: number; heroShield: number; heroOff: boolean; foeOff: boolean; heroEdge: number; foeEdge: number; note: string }

/** What happens when the hero's move meets his. Symmetric in spirit: every move answers some and is answered by others. */
function meet(h: BoutMove, f: BoutMove, d: DuelState): Meet {
  const H = d.hero, F = d.foe, b = d.bout!;
  const r: Meet = { toFoe: 0, toHero: 0, foeShield: 0, heroShield: 0, heroOff: false, foeOff: false, heroEdge: 0, foeEdge: 0, note: '' };
  const holm = d.kind === 'holmgang';
  const hit = (attacker: DuelSide, move: BoutMove) => move === 'heavy' ? heavyDmg(attacker) : move === 'quick' ? quickDmg(attacker) : move === 'bash' ? bashDmg(attacker) : 0;
  const key = `${h}/${f}`;
  switch (key) {
    case 'heavy/heavy': r.toFoe = hit(H, 'heavy'); r.toHero = hit(F, 'heavy'); r.note = 'You trade great blows.'; break;
    case 'heavy/quick': r.toFoe = hit(H, 'heavy'); r.toHero = hit(F, 'quick'); r.note = 'His cut lands first; your blow lands harder.'; break;
    case 'heavy/guard': if (b.foeOff) { r.toFoe = Math.round(hit(H, 'heavy') * BOUT.lateGuard); r.foeShield = BOUT.shieldHeavy; r.note = 'He is still off his line; his shield comes up late and your blow goes over it.'; } else if (F.shields > 0) { r.foeShield = BOUT.shieldHeavy; r.note = 'Your blow lands on his shield and splits the board.'; } else { r.toFoe = Math.round(hit(H, 'heavy') * BOUT.bareGuard); r.note = 'He has no shield left to take it on.'; } break;
    case 'heavy/bash': r.toHero = hit(F, 'bash'); r.heroOff = true; if (F.str < H.str) r.toFoe = Math.round(hit(H, 'heavy') * BOUT.biggerMan); r.note = 'He gets inside your swing with his shield and knocks you off your line.'; break;
    case 'heavy/back': r.foeEdge = holm ? 1 : 0; r.note = 'He steps back out of reach and your blow cuts air.'; break;
    case 'quick/heavy': r.toFoe = hit(H, 'quick'); r.toHero = hit(F, 'heavy'); r.note = 'You cut first; his blow lands harder.'; break;
    case 'quick/quick': r.toFoe = hit(H, 'quick'); r.toHero = hit(F, 'quick'); r.note = 'Two quick cuts, two thin red lines.'; break;
    case 'quick/guard': r.note = 'Your cut turns on his shield.'; break;
    case 'quick/bash': r.toFoe = hit(H, 'quick'); r.foeOff = true; r.note = 'You slip his rush and cut him as he goes past.'; break;
    case 'quick/back': r.toFoe = hit(H, 'quick'); r.foeEdge = holm ? 1 : 0; r.note = 'You catch him as he steps back.'; break;
    case 'guard/heavy': if (b.heroOff) { r.toHero = Math.round(hit(F, 'heavy') * BOUT.lateGuard); r.heroShield = BOUT.shieldHeavy; r.note = 'You are still off your line; your shield comes up late.'; } else if (H.shields > 0) { r.heroShield = BOUT.shieldHeavy; r.note = 'You take his blow on the rim. The board splits.'; } else { r.toHero = Math.round(hit(F, 'heavy') * BOUT.bareGuard); r.note = 'No shield left: you turn half of it with the haft.'; } break;
    case 'guard/quick': r.note = 'His cut turns on your shield.'; break;
    case 'guard/bash': r.heroShield = BOUT.shieldBash; r.heroOff = true; r.note = 'His rush drives your shield back into your face.'; break;
    case 'guard/guard': r.note = 'You watch each other over the rims.'; break;
    case 'guard/back': r.foeEdge = holm ? 1 : 0; r.note = 'He steps back; you let him, and get your breath too.'; break;
    case 'bash/heavy': r.toFoe = hit(H, 'bash'); r.foeOff = true; if (H.str < F.str) { r.toHero = Math.round(hit(F, 'heavy') * BOUT.biggerMan); r.note = 'You get inside his swing and knock him off his line, but he is the bigger man and the haft comes down on your shoulder.'; } else r.note = 'You get inside his swing and knock him off his line.'; break;
    case 'bash/quick': r.toHero = hit(F, 'quick'); r.heroOff = true; r.note = 'He slips your rush and cuts you as you go past.'; break;
    case 'bash/guard': r.foeShield = BOUT.shieldBash; r.foeOff = true; r.note = 'Your rush drives his shield back into his face.'; break;
    case 'bash/bash': r.foeShield = BOUT.shieldBash; r.heroShield = BOUT.shieldBash; r.note = 'Shield crashes on shield.'; break;
    case 'bash/back': r.foeEdge = holm ? 2 : 0; r.note = 'You drive him back across the cloak.'; break;
    case 'back/heavy': r.heroEdge = holm ? 1 : 0; r.note = 'You step back out of reach and his blow cuts air.'; break;
    case 'back/quick': r.toHero = Math.round(hit(F, 'quick') * 0.7); r.heroEdge = holm ? 1 : 0; r.note = 'He catches you as you step back.'; break;
    case 'back/guard': r.heroEdge = holm ? 1 : 0; r.note = 'You step back and get your breath.'; break;
    case 'back/bash': r.heroEdge = holm ? 2 : 0; r.note = 'He drives you back across the cloak.'; break;
    case 'back/back': r.heroEdge = holm ? 1 : 0; r.foeEdge = holm ? 1 : 0; r.note = 'You both step back and breathe.'; break;
  }
  // off balance, and tired arms, change the numbers
  if (b.foeOff) { r.toFoe = Math.round(r.toFoe * BOUT.offBalanceTaken); r.toHero = Math.round(r.toHero * BOUT.offBalanceDealt); }
  if (b.heroOff) { r.toHero = Math.round(r.toHero * BOUT.offBalanceTaken); r.toFoe = Math.round(r.toFoe * BOUT.offBalanceDealt); }
  if (H.stamina <= BOUT.tired) r.toFoe = Math.round(r.toFoe * BOUT.tiredDealt);
  if (F.stamina <= BOUT.tired) r.toHero = Math.round(r.toHero * BOUT.tiredDealt);
  r.toFoe = Math.max(0, r.toFoe - (r.toFoe ? F.armour : 0));
  r.toHero = Math.max(0, r.toHero - (r.toHero ? H.armour : 0));
  return r;
}

export function boutAvailable(d: DuelState, m: BoutMove): { ok: boolean; why?: string } {
  const c = BOUT.cost[m];
  if (c > 0 && d.hero.stamina < c) return { ok: false, why: 'You have not the breath for it.' };
  if (m === 'bash' && d.hero.shields <= 0) return { ok: false, why: 'You have no shield left.' };
  return { ok: true };
}

export interface BoutProjection { toFoe: number; toHero: number; note: string; stamina: number; edge: number; shieldLeft: number; available: boolean; why?: string }

export function projectBout(d: DuelState, m: BoutMove, f: BoutMove = d.bout!.foeIntent): BoutProjection {
  const r = meet(m, f, d);
  const a = boutAvailable(d, m);
  return {
    toFoe: r.toFoe, toHero: r.toHero, note: r.note,
    stamina: Math.max(0, Math.min(d.hero.staminaMax, d.hero.stamina - BOUT.cost[m])),
    edge: d.bout!.heroEdge + r.heroEdge,
    shieldLeft: Math.max(0, d.hero.integrity - r.heroShield),
    available: a.ok, why: a.why,
  };
}

/** His next move, from his habits and his state. Shown to the hero before he chooses. */
export function foeIntent(d: DuelState, rng: RngCursor): BoutMove {
  const F = d.foe, b = d.bout!;
  if (F.stamina <= BOUT.tired) return 'back';
  if (b.foeOff) return F.shields > 0 && rng.float() < 0.5 ? 'guard' : 'back';
  const h = F.habits;
  const w: Record<BoutMove, number> = {
    heavy: F.stamina >= 3 ? (h.strike ?? 1) + (b.heroOff ? 3 : 0) : 0,
    quick: (h.feint ?? 1) + 0.3,
    guard: F.shields > 0 ? (h.guard ?? 1) + (d.hero.stamina >= 6 ? 0.5 : 0) : 0.2,
    bash: F.shields > 0 && F.stamina >= 2 ? 0.4 + F.str * 0.2 : 0,
    back: F.stamina <= 4 ? 1.5 : 0.1,
  };
  return rng.pickWeighted(BOUT_MOVES, (m) => w[m])!;
}

export interface BoutSetup { readScore: number; guile: number; adviser: string | null }

export function startBout(d: DuelState, setup: BoutSetup, rng: RngCursor): void {
  d.bout = { foeIntent: 'guard', foeNext: null, heroOff: false, foeOff: false, heroEdge: 0, foeEdge: 0, readsAhead: setup.readScore >= BOUT.readAhead, read: 'sure', shown: [], readScore: setup.readScore, guile: setup.guile, adviser: setup.adviser };
  d.bout.foeIntent = foeIntent(d, rng);
  readHim(d, rng);
  if (d.bout.readsAhead && d.bout.read === 'sure') d.bout.foeNext = foeIntent(d, rng);
}

/** A man's guile: his wits, and how much he likes a feint. */
export function fighterGuile(f: { guile?: number; attrs: { wit: number }; habits: Partial<Record<string, number>> }): number {
  return f.guile ?? Math.min(3, Math.max(0, f.attrs.wit - 2) + ((f.habits.feint ?? 0) >= 3 ? 1 : 0));
}

function readHim(d: DuelState, rng: RngCursor): void {
  const b = d.bout!;
  b.read = readRoll(b.readScore, b.guile, rng);
  const decoy = DECOY[b.foeIntent];
  if (b.read === 'sure') b.shown = [b.foeIntent];
  else if (b.read === 'likely') b.shown = [rng.float() < 0.75 ? b.foeIntent : decoy];
  else b.shown = rng.float() < 0.5 ? [b.foeIntent, decoy] : [decoy, b.foeIntent];
}

/** One exchange. */
export function boutExchange(d: DuelState, m: BoutMove, rng: RngCursor): void {
  const b = d.bout!;
  if (d.over) return;
  const f = b.foeIntent;
  const r = meet(m, f, d);
  d.exchange += 1;
  const jitter = (n: number) => (n > 0 ? Math.max(1, Math.round(n * (0.85 + rng.float() * 0.3))) : 0);
  const toFoe = jitter(r.toFoe), toHero = jitter(r.toHero);
  d.foe.hp -= toFoe;
  d.hero.hp -= toHero;
  if (toFoe) { d.foe.bled = true; d.foe.hits.push(toFoe); }
  if (toHero) { d.hero.bled = true; d.hero.hits.push(toHero); }
  for (const [side, dmg] of [[d.hero, r.heroShield], [d.foe, r.foeShield]] as const) {
    if (!dmg || side.shields <= 0) continue;
    side.integrity -= dmg;
    if (side.integrity <= 0) {
      side.shields -= 1;
      side.integrity = side.shields > 0 ? (d.kind === 'holmgang' ? 3 : 4) : 0;
      d.log.push(side === d.hero ? (side.shields > 0 ? 'Your shield splits. Your second takes it and hands you the next.' : 'Your last shield splits.') : (side.shields > 0 ? 'His shield splits. He takes another.' : 'His last shield splits.'));
    }
  }
  d.hero.stamina = Math.max(0, Math.min(d.hero.staminaMax, d.hero.stamina - BOUT.cost[m]));
  d.foe.stamina = Math.max(0, Math.min(d.foe.staminaMax, d.foe.stamina - BOUT.cost[f]));
  b.heroOff = r.heroOff;
  b.foeOff = r.foeOff;
  b.heroEdge += r.heroEdge;
  b.foeEdge += r.foeEdge;
  // a man who steps up again wins his ground back
  if (m === 'heavy' || m === 'bash' || m === 'quick') b.heroEdge = Math.max(0, b.heroEdge - (r.heroEdge ? 0 : 1));
  if (f === 'heavy' || f === 'bash' || f === 'quick') b.foeEdge = Math.max(0, b.foeEdge - (r.foeEdge ? 0 : 1));
  const misread = !b.shown.includes(f) ? ' He was not doing what it looked like.' : '';
  d.log.push(`${MOVE_LABEL[m]} against his ${MOVE_LABEL[f].toLowerCase()}.${misread} ${r.note}${toFoe ? ` He takes ${toFoe}.` : ''}${toHero ? ` You take ${toHero}.` : ''}`);
  const holm = d.kind === 'holmgang';
  if (d.hero.hp <= 0) { d.over = 'lost'; return; }
  if (d.foe.hp <= 0) { d.over = 'won'; return; }
  if (holm && b.heroEdge >= BOUT.edge) { d.over = 'yielded'; d.log.push('Your heel comes down on the turf beyond the cloak. You have stepped off it.'); return; }
  if (holm && b.foeEdge >= BOUT.edge) { d.over = 'foe_yielded'; d.log.push('He steps off the cloak with both feet. He has run, and everyone saw it.'); return; }
  if (holm && d.foe.bled && d.foe.hp < d.foe.hpMax / 2 && rng.float() < 0.3) { d.over = 'foe_yielded'; d.log.push('He looks at his blood on the cloak, and lowers his axe. He will pay.'); return; }
  if (d.exchange >= BOUT.maxExchanges) { d.over = 'parted'; return; }
  b.foeIntent = b.foeNext ?? foeIntent(d, rng);
  // what he planned meets what happened
  if (b.foeOff && (b.foeIntent === 'heavy' || b.foeIntent === 'bash')) b.foeIntent = d.foe.shields > 0 ? 'guard' : 'back';
  if (BOUT.cost[b.foeIntent] > d.foe.stamina) b.foeIntent = 'back';
  readHim(d, rng);
  b.foeNext = b.readsAhead && b.read === 'sure' ? foeIntent(d, rng) : null;
}

/** Instinct: the answer that hurts him most for least, keeping breath in hand and never stepping off the cloak. */
function moveValue(d: DuelState, m: BoutMove, f: BoutMove): number {
  const p = projectBout(d, m, f);
  let v = p.toFoe - p.toHero * 1.2;
  if (p.edge >= BOUT.edge) v -= 50;
  if (p.edge === BOUT.edge - 1) v -= 2;
  if (p.stamina <= 1) v -= 1.5;
  if (m === 'guard' || m === 'back') v += 0.3 * Math.max(0, 4 - d.hero.stamina);
  const r = meet(m, f, d);
  if (r.foeOff) v += 2;
  if (r.heroOff) v -= 2;
  v -= r.heroShield * 0.6;
  v += r.foeShield * 0.4;
  if (p.toFoe >= d.foe.hp) v += 20;
  return v;
}

/** Instinct, and the advice from the edge of the cloak: the best answer to what he can see of his man. Torn between
 *  two moves, the answer that does best across both. */
export function boutAuto(d: DuelState): BoutMove {
  const b = d.bout!;
  let best: BoutMove = 'guard', bestV = -Infinity;
  for (const m of BOUT_MOVES) {
    if (!boutAvailable(d, m).ok) continue;
    const v = b.shown.reduce((a, f) => a + moveValue(d, m, f), 0) / Math.max(1, b.shown.length);
    if (v > bestV) { bestV = v; best = m; }
  }
  return best;
}

export function boutAdvice(d: DuelState): { who: string; text: string } | null {
  const b = d.bout!;
  if (!b.adviser || d.over) return null;
  return { who: b.adviser, text: BOUT_ADVICE[boutAuto(d)] };
}

export function fightOutBout(d: DuelState, rng: RngCursor, stopToYield: boolean): void {
  let g = 0;
  while (!d.over && g++ < 40) {
    if (stopToYield && !d.paused && d.kind === 'holmgang' && d.hero.bled && d.hero.hp < d.hero.hpMax * 0.35) { d.paused = true; return; }
    // instinct is not thought: an untrained man falls back on swinging when he should be reading his man
    const slip = rng.float() < Math.max(BOUT.instinctFloor, BOUT.instinctSlip - BOUT.instinctSkill * d.hero.weapons);
    boutExchange(d, slip ? (boutAvailable(d, 'heavy').ok ? 'heavy' : 'guard') : boutAuto(d), rng);
  }
}
