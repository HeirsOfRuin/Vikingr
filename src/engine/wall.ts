// The shield-wall, second form (docs/FRAME-COMBAT-2.md). The author, 2026-10-15: "It doesn't feel like there is
// any real strategy or tactics, just guessing and getting lucky." So:
//  - a battle starts with deployment: where the sworn men stand, how many men are held back, where he stands;
//  - each round the enemy's next move is shown before he chooses (from behind the wall, the move after that too);
//  - his line has cohesion (it breaks at 0), stamina (orders cost it; a tired line hits soft) and ground (pushed
//    back three steps, it breaks);
//  - each order shows what it will do before he commits; chance only moves the numbers a little.
// It lives inside the old BattleState (b.wall), so wounds, the dead, deeds and the story's win/lose links are as before.
import type { BattleState, Position } from './state';
import type { RngCursor } from './rng';
import { qualityMult, qualityGuard } from './battle';

export type WallOrder = 'brace' | 'press' | 'spears' | 'charge' | 'fall_back' | 'reserve';
export type Intent = 'brace' | 'press' | 'volley' | 'charge' | 'feint' | 'flank' | 'reform';
export type SwornPlace = 'front' | 'spread' | 'reserve';

export interface WallState {
  phase: 'deploy' | 'fight';
  /** Deployment goes one question at a time: the sworn men, the reserve, his own place. */
  step: 'sworn' | 'reserve' | 'pos';
  /** Deployment: where the sworn men stand, and the share of men held back. */
  sworn: SwornPlace;
  reserveShare: number;
  reserveMen: number;
  reserveIn: boolean;
  /** Who commands the line: he does, or another man does and he only shouts (the line still takes up his shout). */
  leads: boolean;
  usStamina: number;
  themStamina: number;
  /** + he has pushed them back, - they him. At +3 they break; at -3 his line does. */
  ground: number;
  spears: number;
  themSpears: number;
  intent: Intent;
  next: Intent;
  maxRounds: number;
  /** What he has been doing: the enemy learns. Pushes and charges in a row; rounds standing still in a row. */
  pushes: number;
  waits: number;
}

export const WALL = {
  k: 0.07,
  stamina: 8,
  spears: 2,
  maxRounds: 8,
  /** Cohesion lost for losses: this much for losing the whole line (as now: 12). */
  cohesionFromLosses: 12,
  /** Deployment. */
  frontSwornPower: 1.15,
  spreadCohesion: 1,
  reserveStamina: 3,
  heroFrontPower: 1.1,
  heroFrontCohesion: 0.5,
  /** The hero's blood: base chance a blade finds him in a round, by place; scaled by how hard the round is. */
  heroHit: { front: 0.12, wall: 0.05, rear: 0.012 } as Record<Position, number>,
  manHit: { front: 0.06, wall: 0.03, rear: 0.01 } as Record<Position, number>,
};

export const ORDER_LABEL: Record<WallOrder, string> = {
  brace: 'Lock shields', press: 'Push', spears: 'Throw spears', charge: 'Charge', fall_back: 'Fall back a step', reserve: 'Throw in the reserve',
};
export const INTENT_TEXT: Record<Intent, string> = {
  brace: 'they lock shields and wait for you',
  press: 'they lean into their shields to push',
  volley: 'they ready a volley of spears and javelins',
  charge: 'they are forming a wedge to charge',
  feint: 'they are getting ready to give ground, to draw you after them',
  flank: 'men are slipping round the end of your line',
  reform: 'they are blown, and closing up to get their breath',
};
export const INTENT_SHORT: Record<Intent, string> = {
  brace: 'shields locked', press: 'a push', volley: 'a volley', charge: 'a charge', feint: 'a feigned retreat', flank: 'a flank attack', reform: 'reforming',
};

/** What an order costs in stamina, and what it does when nothing special meets it. */
const ORDER = {
  brace: { cost: -1, out: 0.35, in: 0.55, ground: 0 },
  press: { cost: 2, out: 1.0, in: 1.0, ground: 1 },
  spears: { cost: 1, out: 0.75, in: 0.35, ground: 0 },
  charge: { cost: 3, out: 1.7, in: 1.25, ground: 1 },
  fall_back: { cost: -3, out: 0, in: 0.4, ground: -1 },
  reserve: { cost: -WALL.reserveStamina, out: 0.5, in: 0.55, ground: 0 },
} as const;
const INTENT = {
  brace: { cost: -1, out: 0.35, in: 0.55, ground: 0 },
  press: { cost: 2, out: 1.0, in: 1.0, ground: 1 },
  volley: { cost: 1, out: 0.75, in: 0.35, ground: 0 },
  charge: { cost: 3, out: 1.7, in: 1.25, ground: 1 },
  feint: { cost: -2, out: 0, in: 0.5, ground: -1 },
  flank: { cost: 2, out: 1.2, in: 1.0, ground: 0 },
  reform: { cost: -3, out: 0.2, in: 1.3, ground: 0 },
} as const;

/** The special meetings: [our blows x, their blows x, our cohesion +/-, their cohesion +/-, why]. */
function meeting(o: WallOrder, i: Intent, w: WallState, b: BattleState): { us: number; them: number; ourC: number; theirC: number; note: string } {
  const r = { us: 1, them: 1, ourC: 0, theirC: 0, note: '' };
  const tiredThem = w.themStamina <= 3;
  if (o === 'brace' && i === 'charge') return { ...r, them: 0.5, us: 1.6, theirC: -1.5, note: 'Their wedge breaks on your locked shields.' };
  if (o === 'brace' && i === 'volley') return { ...r, them: 0.4, note: 'The spears thud into shield-boards and do little.' };
  if (o === 'brace' && i === 'flank') return { ...r, them: 1.4, ourC: -1, note: 'Locked shields face front; the blow comes from the side.' };
  if ((o === 'press' || o === 'charge') && i === 'feint') return { ...r, them: 1.6, ourC: -1.5, note: 'They give, you follow, and they turn on you as your line comes apart.' };
  if ((o === 'press' || o === 'charge') && i === 'volley') return { ...r, them: 0.7, us: 1.2, note: 'You close the distance before the second volley.' };
  if ((o === 'press' || o === 'charge') && i === 'reform') return { ...r, us: 1.5, theirC: -1, note: 'You catch them closing up, out of breath.' };
  if (o === 'charge' && tiredThem) return { ...r, us: 1.4, theirC: -1, note: 'The charge hits a tired line.' };
  if (o === 'charge' && i === 'brace') return { ...r, us: 0.5, ourC: -1, note: 'The charge breaks on their locked shields.' };
  if (o === 'press' && i === 'brace') return { ...r, us: 0.6, ourC: -0.5, note: 'You lean into locked shields and get nowhere, and your men feel it.' };
  if (o === 'press' && i === 'press') return { ...r, note: w.usStamina >= w.themStamina ? 'Shield against shield; the fresher line gives less.' : 'Shield against shield; your men are the more tired.' };
  if (o === 'spears' && (i === 'press' || i === 'charge')) return { ...r, us: 1.3, note: 'Your spears go into them as they come on.' };
  if (o === 'spears' && i === 'reform') return { ...r, us: 1.3, note: 'Spears into a line that is not ready for them.' };
  if (o === 'fall_back' && i === 'charge') return { ...r, them: 0.6, theirC: 0, note: 'You give ground in order and their charge hits air and shields.' };
  if (o === 'fall_back' && i === 'flank') return { ...r, them: 0.6, note: 'You fold back and the flank attack finds your face, not your side.' };
  if (o === 'reserve' && i === 'flank') return { ...r, them: 0.3, us: 1.6, theirC: -1, note: 'Your reserve meets the men coming round your flank.' };
  if (o === 'reserve') return { ...r, note: 'Fresh men come up into the line.' };
  if (i === 'flank') return { ...r, ourC: -1, note: 'Men come round the end of your line.' };
  void b;
  return r;
}

function staminaFactor(s: number): number {
  return 0.4 + 0.075 * Math.max(0, s);
}

export interface Projection { dealt: number; taken: number; ourCohesion: number; theirCohesion: number; ourStamina: number; ground: number; note: string; available: boolean; why?: string }

/** What an order will do this round, before chance: the numbers the player sees on the button. */
export function project(b: BattleState, o: WallOrder): Projection {
  const w = b.wall!;
  const i = w.intent;
  const avail = available(b, o);
  const m = meeting(o, i, w, b);
  const op = ORDER[o];
  const ip = INTENT[i];
  const front = w.sworn === 'front' ? WALL.frontSwornPower : 1;
  const heroP = b.position === 'front' && !b.heroDown ? WALL.heroFrontPower : 1;
  const usMen = b.us.men + (o === 'reserve' && !w.reserveIn ? w.reserveMen : 0);
  const usSt = Math.min(WALL.stamina, w.usStamina - op.cost);
  const ourPower = usMen * qualityMult(b.us.quality) * staminaFactor(w.usStamina) * front * heroP;
  const theirPower = b.them.men * qualityMult(b.them.quality) * staminaFactor(w.themStamina);
  const dealt = Math.min(b.them.men, WALL.k * ourPower * op.out * ip.in * m.us * qualityGuard(b.them.quality));
  const taken = Math.min(usMen, WALL.k * theirPower * ip.out * op.in * m.them * qualityGuard(b.us.quality));
  // ground: whoever pushes harder gains it; a fall back gives it
  let ground = 0;
  if (o === 'fall_back') ground = -1;
  else if (i === 'feint' && op.ground > 0) ground = 1;
  else if (op.ground > 0 && ip.ground > 0) ground = ourPower * staminaFactor(w.usStamina) > theirPower * staminaFactor(w.themStamina) * 1.05 ? 1 : ourPower * staminaFactor(w.usStamina) * 1.05 < theirPower * staminaFactor(w.themStamina) ? -1 : 0;
  // a line that is not set gives ground: one that is reforming, or throwing, or busy with a flank
  else if (op.ground > 0 && (i === 'reform' || i === 'volley')) ground = 1;
  else if (ip.ground > 0 && o === 'spears') ground = -1;
  const ourLoss = cohesionLoss(taken, b.us.start, b.us.quality) - m.ourC + (ground < 0 ? 0.5 : 0) + (o === 'fall_back' && b.us.quality < 1 ? 0.5 : 0);
  const theirLoss = cohesionLoss(dealt, b.them.start, b.them.quality) - m.theirC + (ground > 0 ? 0.5 : 0);
  return {
    dealt: Math.round(dealt), taken: Math.round(taken),
    ourCohesion: Math.round((b.us.morale - ourLoss) * 10) / 10,
    theirCohesion: Math.round((b.them.morale - theirLoss) * 10) / 10,
    ourStamina: Math.max(0, usSt),
    ground: Math.max(-3, Math.min(3, w.ground + ground)),
    note: m.note,
    available: avail.ok,
    why: avail.why,
  };
}

function cohesionLoss(cas: number, start: number, quality: number): number {
  return (WALL.cohesionFromLosses * cas / Math.max(1, start)) * (1.15 - 0.15 * quality);
}

export function available(b: BattleState, o: WallOrder): { ok: boolean; why?: string } {
  const w = b.wall!;
  const cost = ORDER[o].cost;
  if (cost > 0 && w.usStamina < cost) return { ok: false, why: 'Your men are too blown for that.' };
  if (o === 'spears' && w.spears <= 0) return { ok: false, why: 'The spears are thrown.' };
  if (o === 'reserve' && (w.reserveIn || w.reserveMen <= 0)) return { ok: false, why: w.reserveIn ? 'The reserve is already in.' : 'You kept no reserve.' };
  if (o === 'fall_back' && b.terrain === 'ship') return { ok: false, why: 'There is nowhere to fall back to on a ship.' };
  return { ok: true };
}

export const WALL_ORDERS: WallOrder[] = ['brace', 'press', 'spears', 'charge', 'fall_back', 'reserve'];

/** The enemy's next move: what tired men, men with spears left, and men whose doctrine likes it, do. Rolled ahead so it can be shown. */
export function enemyIntent(b: BattleState, stamina: number, spears: number, round: number, rng: RngCursor): Intent {
  const d = b.them.doctrine;
  if (stamina <= 2) return rng.float() < 0.7 ? 'reform' : 'feint';
  // they learn: a man who keeps pushing meets locked shields and a feigned retreat; a man who stands still is flanked
  const pushes = b.wall?.pushes ?? 0, waits = b.wall?.waits ?? 0;
  const w: Partial<Record<Intent, number>> = {
    brace: (d.hold ?? 0.2) + 0.1 + 0.7 * pushes,
    press: (d.push ?? 0.2) + 0.2 + 0.5 * waits,
    volley: spears > 0 ? (d.missiles ?? 0.2) + (round <= 1 ? 1.5 : 0) : 0,
    charge: stamina >= 5 ? (d.wedge ?? 0.2) + (b.wall && b.wall.usStamina <= 3 ? 1.5 : 0) : 0,
    feint: b.terrain === 'ship' ? 0 : (d.give ?? 0.2) + 0.6 * pushes,
    flank: b.them.men >= b.us.men * (waits >= 2 ? 0.9 : 1.2) && !['ship', 'ford', 'rampart'].includes(b.terrain) ? (d.flank ?? 0.2) + 0.3 + 0.5 * waits : 0,
    reform: stamina <= 4 ? 1 : 0,
  };
  const keys = (Object.keys(w) as Intent[]).filter((k) => (w[k] ?? 0) > 0);
  return rng.pickWeighted(keys, (k) => w[k]!)!;
}

export function startWall(b: BattleState, leads: boolean, rng: RngCursor): void {
  b.wall = {
    phase: 'deploy',
    step: leads ? 'sworn' : 'pos',
    sworn: 'spread',
    reserveShare: 0,
    reserveMen: 0,
    reserveIn: false,
    leads,
    usStamina: WALL.stamina,
    themStamina: WALL.stamina,
    ground: 0,
    spears: WALL.spears,
    themSpears: WALL.spears,
    intent: 'brace',
    next: 'brace',
    maxRounds: WALL.maxRounds,
    pushes: 0,
    waits: 0,
  };
  const w = b.wall;
  w.intent = enemyIntent(b, w.themStamina, w.themSpears, 1, rng);
  w.next = enemyIntent(b, w.themStamina, w.themSpears, 2, rng);
}

/** Deployment, before the first round: where the sworn men stand, the reserve, and where he stands. */
/** One deployment question answered; the last one starts the fight. Another man's line: he only picks his place. */
export function deployStep(b: BattleState, what: 'sworn' | 'reserve' | 'pos', value: string): void {
  const w = b.wall!;
  if (what === 'sworn') { w.sworn = value as SwornPlace; w.step = 'reserve'; return; }
  if (what === 'reserve') { w.reserveShare = Number(value); w.step = 'pos'; return; }
  deploy(b, w.sworn, w.leads ? w.reserveShare : 0, value as Position);
}

export function deploy(b: BattleState, sworn: SwornPlace, reserveShare: number, pos: Position): void {
  const w = b.wall!;
  w.sworn = sworn;
  b.position = pos;
  w.reserveShare = reserveShare;
  w.reserveMen = Math.round(b.us.men * reserveShare);
  b.us.men -= w.reserveMen;
  if (sworn === 'spread') b.us.morale += WALL.spreadCohesion;
  if (pos === 'front') b.us.morale += WALL.heroFrontCohesion;
  // the sworn men held back are the reserve's spine: they come in later, with the fresh men
  for (const n of b.named) n.slot = sworn === 'front' ? 'front' : sworn === 'reserve' ? 'rear' : n.slot;
  w.phase = 'fight';
  b.log.push(`${sworn === 'front' ? 'Your sworn men take the front rank' : sworn === 'spread' ? 'Your sworn men spread through the line, one to every few benches' : 'Your sworn men stand back with the reserve'}${w.reserveMen ? `; ${w.reserveMen} men held back` : ''}. You stand ${pos === 'front' ? 'in the front rank' : pos === 'wall' ? 'in the wall' : 'behind it'}.`);
}

/** One round: his order against the move they showed him. */
export function wallRound(b: BattleState, o: WallOrder, rng: RngCursor): void {
  const w = b.wall!;
  if (b.over || w.phase !== 'fight') return;
  const p = project(b, o);
  b.round += 1;
  const jitter = () => 0.85 + rng.float() * 0.3;
  const i = w.intent;
  if (o === 'reserve') { b.us.men += w.reserveMen; b.us.start += 0; w.reserveIn = true; w.reserveMen = 0; if (w.sworn === 'reserve') b.us.morale += 1; }
  if (o === 'spears') w.spears -= 1;
  if (i === 'volley') w.themSpears -= 1;
  const dealt = Math.min(b.them.men, Math.round(p.dealt * jitter()));
  const taken = Math.min(b.us.men, Math.round(p.taken * jitter()));
  b.them.men -= dealt;
  b.us.men -= taken;
  b.killed += dealt;
  b.lost += taken;
  // the cohesion shown, give or take what chance did to the casualties
  b.us.morale = Math.min(10, p.ourCohesion - cohesionLoss(taken - p.taken, b.us.start, b.us.quality));
  b.them.morale = Math.min(10, p.theirCohesion - cohesionLoss(dealt - p.dealt, b.them.start, b.them.quality));
  w.usStamina = Math.max(0, Math.min(WALL.stamina, w.usStamina - ORDER[o].cost));
  w.pushes = o === 'press' || o === 'charge' ? w.pushes + 1 : 0;
  w.waits = o === 'brace' || o === 'fall_back' ? w.waits + 1 : 0;
  w.themStamina = Math.max(0, Math.min(WALL.stamina, w.themStamina - INTENT[i].cost));
  w.ground = p.ground;
  b.log.push(`Round ${b.round}: ${ORDER_LABEL[o].toLowerCase()} against ${INTENT_SHORT[i]}. ${p.note ? p.note + ' ' : ''}They lose ${dealt}, you lose ${taken}.`);
  heroAndMen(b, o, i, rng);
  // the end of it
  if (w.ground <= -3) b.us.morale = Math.min(b.us.morale, 0);
  if (w.ground >= 3) b.them.morale = Math.min(b.them.morale, 0);
  const usBroken = b.us.morale <= 0 || b.us.men <= 0;
  const themBroken = b.them.morale <= 0 || b.them.men <= 0;
  if (themBroken && !usBroken) {
    const chase = Math.round(b.them.men * 0.15);
    b.them.men -= chase; b.killed += chase;
    b.over = 'won';
    b.log.push(w.ground >= 3 ? `They are pushed off the field, and run. You cut down ${chase} more.` : `They break. You cut down ${chase} more as they run.`);
  } else if (usBroken) {
    const chase = Math.round(b.us.men * (o === 'fall_back' ? 0.07 : 0.15));
    b.us.men -= chase; b.lost += chase;
    b.over = 'lost';
    b.log.push(`Your men break for the ships. ${chase} more are cut down from behind.`);
  } else if (b.round >= w.maxRounds) {
    b.over = 'parted';
    b.log.push('Both walls fall back, spent. Neither side has the strength to go again today.');
  } else {
    w.intent = w.next;
    // a plan meets the field: tired men and empty hands change it
    if (w.themStamina <= 2 && w.intent !== 'reform' && w.intent !== 'feint') w.intent = 'reform';
    if (w.intent === 'volley' && w.themSpears <= 0) w.intent = 'press';
    if (w.intent === 'charge' && w.themStamina < 3) w.intent = 'reform';
    w.next = enemyIntent(b, w.themStamina - INTENT[w.intent].cost, w.themSpears - (w.intent === 'volley' ? 1 : 0), b.round + 2, rng);
  }
}

function heroAndMen(b: BattleState, o: WallOrder, i: Intent, rng: RngCursor): void {
  const hard = (INTENT[i].out + ORDER[o].in) / 2;
  const guard = b.heroSkill ? Math.min(1.2, Math.max(0.6, 1 - 0.06 * (b.heroSkill.shield - 2))) : 1;
  if (!b.heroDown && rng.float() < WALL.heroHit[b.position] * hard * guard) {
    const dmg = Math.max(1, 3 + rng.int(7) + Math.round(b.them.quality) - b.heroArmour);
    b.heroHp -= dmg;
    b.heroHits.push(dmg);
    if (b.heroHp <= 0) {
      b.heroDown = true;
      b.us.morale -= 2;
      b.log.push('You go down. Someone drags you back behind the shields by your belt.');
    } else b.log.push(`A blade finds you (${dmg}).`);
  }
  const w = b.wall!;
  for (const n of b.named) {
    if (n.down) continue;
    if (n.slot === 'rear' && w.sworn === 'reserve' && !w.reserveIn) continue;
    if (rng.float() < WALL.manHit[n.slot] * hard) {
      if (rng.float() < 0.3) { n.down = true; b.log.push(`${n.name} falls.`); }
      else if (!n.hurt) { n.hurt = true; b.log.push(`${n.name} is hurt, and keeps his place.`); }
    } else if ((o === 'press' || o === 'charge') && n.slot === 'front' && rng.float() < 0.12) {
      b.deeds.push({ type: 'man_deed', text: `${n.name} broke their shield-wall`, who: n.id });
      b.log.push(`${n.name} breaks a man's shield and the man behind it.`);
    }
  }
  if (!b.heroDown && b.position === 'front' && (o === 'press' || o === 'charge') && rng.float() < 0.15) {
    b.deeds.push({ type: 'front_deed', text: 'Cut his way through their front rank', who: null });
    b.log.push('You are through their front rank, and they know your face now.');
  }
}

/** "Let the men handle it" in the new wall: the order that does most harm to their line for least to his, keeping
 *  something in hand. The same numbers the player sees. */
export function wallAuto(b: BattleState): WallOrder {
  let best: WallOrder = 'brace';
  let bestV = -Infinity;
  for (const o of WALL_ORDERS) {
    const p = project(b, o);
    if (!p.available) continue;
    const theirLoss = b.them.morale - p.theirCohesion;
    const ourLoss = b.us.morale - p.ourCohesion;
    let v = theirLoss - ourLoss * 1.1 + (p.ground - b.wall!.ground) * 1.2;
    // the day is short: a battle not won by the last rounds is a battle broken off
    if (b.round >= b.wall!.maxRounds - 3) v += theirLoss * 0.5;
    if (p.ourStamina <= 1 && o !== 'fall_back') v -= 1;
    if (o === 'reserve' && b.round < 2 && b.wall!.intent !== 'flank') v -= 1.5;
    if (p.theirCohesion <= 0) v += 5;
    if (p.ourCohesion <= 0) v -= 5;
    if (v > bestV) { bestV = v; best = o; }
  }
  return best;
}

export function deployAuto(b: BattleState): { sworn: SwornPlace; reserve: number; pos: Position } {
  return { sworn: 'spread', reserve: b.them.men > b.us.men * 1.1 ? 0.15 : 0, pos: b.position };
}

export function fightOutWall(b: BattleState, rng: RngCursor): void {
  if (b.wall!.phase === 'deploy') { const d = deployAuto(b); deploy(b, d.sworn, d.reserve, d.pos); }
  let g = 0;
  while (!b.over && g++ < 20) wallRound(b, wallAuto(b), rng);
}
